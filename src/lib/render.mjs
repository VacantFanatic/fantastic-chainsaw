// The field note renderer: plain text in, HTML out.
//
// Ported wholesale from the old netlify/functions/publish.mjs when field
// notes moved to Astro + Supabase. Nothing about how a note *looks* was
// meant to change in that move, so this is the same code with the same
// tests -- only its callers changed. It stays a plain .mjs module with no
// Astro or Supabase imports precisely so `node --test` can exercise it
// directly, the way it always could.
//
// Everything here is pure except fetchLinkPreview/fetchLinkPreviews, which
// are the two functions that reach the network.

// A standalone link (a paragraph that's nothing but a URL) gets a preview
// card fetched once, when the note is saved, and stored alongside it --
// never fetched on a reader's behalf. These limits keep a post with many
// links from blowing past the request budget: fetched in parallel, so the
// worst case is one timeout, not the sum.
export const MAX_LINK_PREVIEWS = 5;
const LINK_FETCH_TIMEOUT_MS = 6000;
const MAX_PREVIEW_HTML_BYTES = 300000;

// Basic hygiene, not a hardened SSRF defense -- the input source is the
// site owner's own signed-in admin form, not public traffic, but there's
// no reason to let a pasted link make the server fetch its own private
// network.
const PRIVATE_HOST_RE =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?)/i;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Carries an HTTP status and a machine-readable code so an API route can
// turn a failure into a response without re-deriving what went wrong.
export class RenderError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

/* ---------------------------------------------------------
   Pure helpers -- exercised directly by tests/render.test.mjs.
   --------------------------------------------------------- */

export function slugify(title) {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "post";
}

export function uniqueSlug(base, posts) {
  const existing = new Set(posts.map((p) => p.slug));
  if (!existing.has(base)) return base;
  for (let i = 2; i <= 25; i += 1) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  throw new RenderError(
    409,
    "slug_collision",
    "could not find a unique slug after 25 attempts",
  );
}

export function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function cdata(s) {
  // ]]> is the one sequence that breaks a CDATA section; split it across
  // two sections if it ever shows up.
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

// A paragraph that's exactly one bare URL, and nothing else -- the same
// "link on its own line unfurls" convention Slack/Discord/Twitter use. A
// URL inside a sentence is auto-linked (see linkify below) but doesn't
// get a card, so cards don't litter the middle of a paragraph.
const STANDALONE_URL_RE = /^https?:\/\/\S+$/i;

// Deliberately excludes trailing sentence punctuation from the match, so
// "check this out: https://example.com." doesn't swallow the period into
// the URL.
const INLINE_URL_RE = /https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"]/g;

export function extractStandaloneLinks(rawBody) {
  const paragraphs = rawBody
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const links = [];
  const seen = new Set();
  for (const para of paragraphs) {
    if (STANDALONE_URL_RE.test(para) && !seen.has(para)) {
      seen.add(para);
      links.push(para);
    }
  }
  return links.slice(0, MAX_LINK_PREVIEWS);
}

// Applied to already-escaped text: escaping first means there's no
// markup yet for the regex to accidentally cross into, and HTML entities
// like &amp; are valid (and correctly decode back to &) both inside an
// href and inside displayed text, so the same escaped substring works in
// both places.
function linkify(escapedText) {
  return escapedText.replace(
    INLINE_URL_RE,
    (match) => `<a href="${match}">${match}</a>`,
  );
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function renderLinkCard(url, preview) {
  const safeUrl = escapeHtml(url);
  const domain = escapeHtml(hostnameOf(url));

  if (!preview) {
    // No usable preview (fetch failed, timed out, blocked, or the page
    // had no title) -- still a box, per the design, just a minimal one
    // rather than silently falling back to a plain paragraph.
    return `<a class="link-card link-card--plain" href="${safeUrl}">
        <span class="link-card__domain">${domain} &rarr;</span>
      </a>`;
  }

  const image = preview.image
    ? `<img class="link-card__image" src="${escapeHtml(preview.image)}" alt="" loading="lazy" />`
    : "";
  const description = preview.description
    ? `<span class="link-card__description">${escapeHtml(preview.description)}</span>`
    : "";

  return `<a class="link-card" href="${safeUrl}">
        ${image}
        <span class="link-card__body">
          <span class="link-card__title">${escapeHtml(preview.title)}</span>
          ${description}
          <span class="link-card__domain">${domain}</span>
        </span>
      </a>`;
}

export function renderBody(raw, previews = new Map()) {
  return raw
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((para) => {
      if (STANDALONE_URL_RE.test(para)) {
        return renderLinkCard(para, previews.get(para));
      }
      const escaped = escapeHtml(para).replace(/\n/g, "<br />\n");
      return `<p>${linkify(escaped)}</p>`;
    })
    .join("\n");
}

// Hand-rolled rather than Intl/toLocaleDateString: Lambda-style runtimes
// ship small-ICU builds, and locale data is unnecessary risk for something
// this simple.
export function humanDate(iso) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

// toUTCString() already returns exactly the RFC 1123 form RSS wants for
// pubDate -- no hand-rolled formatter needed.
export function rfc822(iso) {
  return new Date(iso).toUTCString();
}

export function makeExcerpt(body) {
  const plain = body.replace(/\s+/g, " ").trim();
  if (plain.length <= 160) return plain;
  const cut = plain.slice(0, 160);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : 160)}…`;
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function metaContent(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeHtmlEntities(m[1].trim());
  }
  return "";
}

// Regex, not a real HTML parser -- pulling four meta tags out of a <head>
// doesn't need one, and adding one would mean an npm dependency for the
// one piece of the site that's supposed to have none.
export function parseOgTags(html, baseUrl) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? html;

  const ogTitle = metaContent(head, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i,
  ]);
  const title = ogTitle || metaContent(head, [/<title[^>]*>([^<]*)<\/title>/i]);
  if (!title) return null;

  const description = metaContent(head, [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
  ]);

  const ogImage = metaContent(head, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i,
    /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:image["']/i,
  ]);
  let image = "";
  if (ogImage) {
    try {
      image = new URL(ogImage, baseUrl).href;
    } catch {
      image = "";
    }
  }

  return {
    url: baseUrl,
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image,
  };
}

export function isFetchableUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    (u.protocol === "http:" || u.protocol === "https:") &&
    !PRIVATE_HOST_RE.test(u.hostname)
  );
}

async function readCapped(res, maxBytes) {
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      chunks.push(value.subarray(0, value.length - (total - maxBytes)));
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// The only impure piece of the link-preview pipeline -- everything it
// hands off to (parseOgTags) is pure and unit-tested with fixture HTML.
// Never throws: any failure (bad URL, private host, timeout, non-HTML
// response, no usable title) becomes null, which renderLinkCard renders
// as a minimal fallback box rather than aborting the publish.
export async function fetchLinkPreview(url) {
  if (!isFetchableUrl(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LINK_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // An honest bot UA, not a spoofed browser one -- og: tags exist
        // specifically for link-unfurling bots (Slack, Twitter, Discord
        // all identify themselves the same way).
        "User-Agent": "STATICFieldNotesBot/1.0 (+link preview)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;
    if (!(res.headers.get("content-type") || "").includes("html")) {
      return null;
    }

    const html = await readCapped(res, MAX_PREVIEW_HTML_BYTES);
    return parseOgTags(html, res.url || url);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fetches previews for every standalone link in parallel and returns a
// Map keyed by the raw URL text, so renderBody can look each one up by
// the same string it split the paragraph on. Parallel rather than
// sequential so the worst case is one timeout, not the sum of all of
// them -- serverless functions have an execution budget.
export async function fetchLinkPreviews(links) {
  const previews = new Map();
  if (links.length === 0) return previews;

  const results = await Promise.allSettled(links.map(fetchLinkPreview));
  links.forEach((url, i) => {
    const result = results[i];
    previews.set(url, result.status === "fulfilled" ? result.value : null);
  });
  return previews;
}
