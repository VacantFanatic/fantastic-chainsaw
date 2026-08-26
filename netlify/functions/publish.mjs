// Half of the one backend piece on this otherwise fully static site. A
// secret-gated endpoint that takes a title + plain-text body and commits a
// new field note straight to this repo's `main` branch via the GitHub
// Contents API. Its counterpart, unpublish.mjs, takes a note back out
// again, and imports this file's renderers and GitHub plumbing rather than
// keeping a second copy of them.
// Zero npm dependencies on purpose -- only built-in Node/Fetch APIs -- so
// "no runtime dependencies" stays true even for the backend. See CLAUDE.md
// for why this is the one deliberate exception to the site's rules.

import { createHash, timingSafeEqual } from "node:crypto";

const GITHUB_API = "https://api.github.com";

// A standalone link (a paragraph that's nothing but a URL) gets a preview
// card fetched at publish time and baked into the static page -- never
// fetched client-side, so the reading experience stays fully static with
// no CORS proxy and no runtime dependency for visitors. These limits keep
// a post with many links from blowing past the function's execution
// budget: fetched in parallel, so worst case is one timeout, not the sum.
const MAX_LINK_PREVIEWS = 5;
const LINK_FETCH_TIMEOUT_MS = 6000;
const MAX_PREVIEW_HTML_BYTES = 300000;

// Basic hygiene, not a hardened SSRF defense -- the input source is the
// site owner's own trusted admin form, not public traffic, but there's no
// reason to let a pasted link make the function fetch its own private
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

// The rendered page is HTML; the thing a human wrote is plain text. Keeping
// the plain text next to the page is what makes an edit possible later --
// edit.mjs reads this back rather than trying to reverse-engineer prose out
// of generated markup. Public, like everything else here, and identical in
// content to the post it belongs to.
export function sourcePath(slug) {
  return `pages/field-notes/sources/${slug}.txt`;
}

class PublishError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export class GitHubApiError extends Error {
  constructor(step, status, detail) {
    super(`GitHub API failed at step "${step}": ${status} ${detail}`);
    this.step = step;
    this.status = status;
    this.detail = detail;
  }
}

/* ---------------------------------------------------------
   Pure helpers -- exported for unit testing (publish.test.mjs)
   and for unpublish.mjs, which regenerates the same listing and
   feed after removing a note. Netlify only ever calls the
   default export, so the named ones cost nothing in production.
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
  throw new PublishError(
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

export function renderPostPage(post, rawBody, previews = new Map()) {
  const title = escapeHtml(post.title);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title} — STATIC</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../../../css/style.css" />
    <link rel="stylesheet" href="../field-notes.css" />
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230b0f0a'/%3E%3Crect x='3' y='3' width='4' height='4' fill='%2363e08a'/%3E%3Crect x='9' y='3' width='4' height='4' fill='%2363e08a'/%3E%3Crect x='3' y='9' width='4' height='4' fill='%2363e08a'/%3E%3Crect x='9' y='9' width='4' height='4' fill='%2363e08a'/%3E%3C/svg%3E"
    />
  </head>
  <body>
    <main class="note">
      <p class="note__nav">
        <a href="../field-notes.html">&larr; back to field notes</a>
        &middot;
        <a href="../../../index.html">back to index</a>
      </p>
      <p class="note__date">${humanDate(post.date)}</p>
      <h1 class="note__title">${title}</h1>
      <div class="note__body">
${renderBody(rawBody, previews)}
      </div>
    </main>
  </body>
</html>
`;
}

export function renderListingPage(posts) {
  const count = posts.length;
  const body =
    count === 0
      ? `      <p class="field-notes__empty">nothing published yet.</p>\n`
      : `      <ol class="directory__list">
${posts
  .map((p, i) => {
    const num = String(count - i).padStart(2, "0");
    return `        <li class="entry">
          <a class="entry__link" href="posts/${p.slug}.html">
            <span class="entry__num">${num}</span>
            <span class="entry__name">${escapeHtml(p.title)}</span>
            <span class="entry__kind">[note / ${humanDate(p.date)}]</span>
          </a>
          <p class="entry__note">${escapeHtml(p.excerpt)}</p>
        </li>`;
  })
  .join("\n")}
      </ol>\n`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>field notes — STATIC</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="../../css/style.css" />
    <link rel="stylesheet" href="field-notes.css" />
    <link
      rel="alternate"
      type="application/rss+xml"
      title="STATIC — field notes"
      href="feed.xml"
    />
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230b0f0a'/%3E%3Crect x='3' y='3' width='4' height='4' fill='%2363e08a'/%3E%3Crect x='9' y='3' width='4' height='4' fill='%2363e08a'/%3E%3Crect x='3' y='9' width='4' height='4' fill='%2363e08a'/%3E%3Crect x='9' y='9' width='4' height='4' fill='%2363e08a'/%3E%3C/svg%3E"
    />
  </head>
  <body>
    <p class="back-link"><a href="../../index.html">&larr; back to index</a></p>
    <main class="directory">
      <p class="directory__label">index of /field-notes/</p>
${body}      <p class="field-notes__feed"><a href="feed.xml">RSS</a></p>
    </main>
  </body>
</html>
`;
}

export function renderFeed(posts, siteUrl) {
  const channelLink = `${siteUrl}/pages/field-notes/field-notes.html`;
  const items = posts
    .map((p) => {
      const link = `${siteUrl}/pages/field-notes/posts/${p.slug}.html`;
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(p.date)}</pubDate>
      <description>${cdata(escapeHtml(p.excerpt))}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>STATIC — field notes</title>
    <link>${channelLink}</link>
    <description>long-form notes, plain text, newest first.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

/* ---------------------------------------------------------
   GitHub API -- shared with unpublish.mjs.

   Reads go through the Contents API: one file, one call. Writes go
   through the lower-level Git Data API instead, because the Contents
   API can only write one file per commit -- and a publish touches
   four files, which meant four commits, four pushes, and four Netlify
   builds for a single note. Assembling the tree by hand costs a
   handful more requests but produces exactly one commit, so exactly
   one build. It also makes a publish atomic for free: either the
   whole note lands or none of it does, with no half-finished state
   where the manifest, the listing and the feed disagree.
   --------------------------------------------------------- */

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    // GitHub's API 403s any request with no User-Agent; Node's fetch
    // doesn't set one by default.
    "User-Agent": "static-field-notes-publish-fn",
  };
}

// Returns the file's text, or null if it isn't there.
export async function ghGetFile(repo, path) {
  const res = await fetch(
    `${GITHUB_API}/repos/${repo}/contents/${path}?ref=main`,
    { headers: ghHeaders() },
  );
  if (res.status === 404) return null;
  if (!res.ok)
    throw new GitHubApiError(`get:${path}`, res.status, await res.text());
  const json = await res.json();
  return Buffer.from(json.content, "base64").toString("utf8");
}

async function ghJson(step, url, { method = "GET", body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      ...ghHeaders(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new GitHubApiError(step, res.status, await res.text());
  return res.json();
}

// One commit on `main` covering every entry in `files`. An entry is
// either `{ path, content }` to write that file or `{ path, content:
// null }` to remove it -- a tree entry with a null sha is how the Git
// Data API spells "this path is gone".
export async function ghCommit(repo, message, files) {
  const git = `${GITHUB_API}/repos/${repo}/git`;

  const ref = await ghJson("get:ref", `${git}/ref/heads/main`);
  const parentSha = ref.object.sha;
  const parent = await ghJson("get:commit", `${git}/commits/${parentSha}`);

  const tree = await ghJson("create:tree", `${git}/trees`, {
    method: "POST",
    body: {
      base_tree: parent.tree.sha,
      tree: files.map(({ path, content }) => ({
        path,
        mode: "100644",
        type: "blob",
        ...(content === null ? { sha: null } : { content }),
      })),
    },
  });

  const commit = await ghJson("create:commit", `${git}/commits`, {
    method: "POST",
    body: { message, tree: tree.sha, parents: [parentSha] },
  });

  // Deliberately not a force update: if anything else pushed to main
  // between reading the ref and writing it, GitHub rejects this as a
  // non-fast-forward instead of quietly dropping that commit.
  await ghJson("update:ref", `${git}/refs/heads/main`, {
    method: "PATCH",
    body: { sha: commit.sha },
  });

  return commit;
}

/* ---------------------------------------------------------
   Handler
   --------------------------------------------------------- */

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function secretIsValid(candidate) {
  const expected = process.env.PUBLISH_SECRET ?? "";
  // Hash both sides to a fixed-length digest first: timingSafeEqual throws
  // on mismatched-length buffers rather than returning false, so comparing
  // raw strings would let a short guess crash the request instead of just
  // failing it.
  const a = createHash("sha256")
    .update(String(candidate ?? ""))
    .digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const { title, body, secret } = payload ?? {};

  if (!secretIsValid(secret)) {
    return json(401, { error: "unauthorized" });
  }

  if (
    typeof title !== "string" ||
    typeof body !== "string" ||
    title.trim() === "" ||
    body.trim() === ""
  ) {
    return json(400, {
      error: "missing_fields",
      detail: "title and body are required",
    });
  }
  if (title.length > 200 || body.length > 20000) {
    return json(400, { error: "too_long" });
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const siteUrl = process.env.URL;
  if (!repo || !process.env.GITHUB_TOKEN) {
    return json(500, { error: "server_misconfigured" });
  }
  if (!siteUrl) {
    return json(500, { error: "site_url_unconfigured" });
  }

  try {
    const manifest = await ghGetFile(repo, "pages/field-notes/posts.json");
    const posts = manifest ? JSON.parse(manifest) : [];

    const slug = uniqueSlug(slugify(title), posts);
    const post = {
      slug,
      title,
      date: new Date().toISOString(),
      excerpt: makeExcerpt(body),
    };

    const previews = await fetchLinkPreviews(extractStandaloneLinks(body));

    const newPosts = [post, ...posts];

    // The new page, its plain-text source, and all three generated files
    // they have to stay in step with, in a single commit -- one push, one
    // Netlify build, and no window where the listing advertises a note
    // that isn't there yet.
    await ghCommit(repo, `field notes: publish "${title}"`, [
      {
        path: `pages/field-notes/posts/${slug}.html`,
        content: renderPostPage(post, body, previews),
      },
      { path: sourcePath(slug), content: `${body.trim()}\n` },
      {
        path: "pages/field-notes/posts.json",
        content: `${JSON.stringify(newPosts, null, 2)}\n`,
      },
      {
        path: "pages/field-notes/field-notes.html",
        content: renderListingPage(newPosts),
      },
      {
        path: "pages/field-notes/feed.xml",
        content: renderFeed(newPosts, siteUrl),
      },
    ]);

    return json(200, {
      ok: true,
      slug,
      url: `${siteUrl}/pages/field-notes/posts/${slug}.html`,
    });
  } catch (err) {
    if (err instanceof PublishError) {
      return json(err.status, { error: err.code, detail: err.message });
    }
    if (err instanceof GitHubApiError) {
      return json(502, {
        error: "github_api_error",
        step: err.step,
        status: err.status,
        detail: err.detail,
      });
    }
    return json(500, { error: "unexpected_error", detail: String(err) });
  }
};

export const config = { path: "/api/publish" };
