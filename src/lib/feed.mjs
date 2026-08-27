// RSS/Atom parsing for "the wire". A plain .mjs module with no Astro
// imports, same reason as render.mjs: `node --test` exercises it
// directly. Everything here is pure except fetchFeed, the one function
// that reaches the network.
//
// Regex, not a real XML parser -- same rationale as render.mjs's
// parseOgTags: pulling a handful of tags out of an <item>/<entry> block
// doesn't need one, and adding one would mean an npm dependency for the
// one part of the site that's supposed to have none.

import { RenderError, isFetchableUrl, makeExcerpt } from "./render.mjs";

export const MAX_ITEMS_PER_FEED = 25;
const FEED_FETCH_TIMEOUT_MS = 8000;
// Larger than render.mjs's 300KB cap for a single page's <head> -- a full
// feed with 25 items and descriptions legitimately runs bigger.
const MAX_FEED_BYTES = 1_500_000;

/* ---------------------------------------------------------
   Pure helpers -- exercised directly by tests/feed.test.mjs.
   --------------------------------------------------------- */

// Named-entity table duplicated from render.mjs rather than imported
// (module-private there, same "small helper, small duplication" call
// already made for the per-route json() responses), plus numeric
// character references (&#8217; / &#x2019;) that render.mjs's version
// doesn't handle -- real feeds lean heavily on numeric refs for smart
// quotes and dashes (confirmed against a live NASA feed while building
// this), where render.mjs's OG-tag scraping mostly hasn't needed them.
function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
}

function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1");
}

// Some feeds embed raw HTML even in <title>, and the ticker only ever
// displays plain text -- it never re-renders third-party markup.
function stripTags(s) {
  return s.replace(/<[^>]*>/g, " ");
}

function cleanText(raw) {
  if (raw == null) return "";
  // Entities decode before tags strip: a description is often HTML
  // *entity-escaped* (literal "&lt;p&gt;") rather than containing real
  // "<p>" tags directly, so stripping tags first would never see them.
  return stripTags(decodeHtmlEntities(stripCdata(raw)))
    .replace(/\s+/g, " ")
    .trim();
}

// First-match, non-greedy tag-content extraction: <tag ...>TEXT</tag>.
function tagText(xml, tagName) {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i");
  return cleanText(xml.match(re)?.[1]);
}

// Atom's <link href="..."/> is attribute-based, not text content, and
// more than one <link> can appear (alternate/self/enclosure) -- prefer
// rel="alternate" (or no rel at all, which defaults to alternate) over
// the others.
function atomLinkHref(entryXml) {
  const links = [...entryXml.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => {
    const attrs = m[1];
    return {
      href: attrs.match(/href=["']([^"']*)["']/i)?.[1],
      rel: attrs.match(/rel=["']([^"']*)["']/i)?.[1] ?? "alternate",
    };
  });
  const withHref = links.filter((l) => l.href);
  return (
    withHref.find((l) => l.rel === "alternate")?.href ?? withHref[0]?.href ?? ""
  );
}

// Returns an ISO string or null -- never throws. Both RSS's pubDate
// (RFC 822) and Atom's updated/published (ISO 8601) parse fine with the
// built-in Date constructor; no hand-rolled date parser needed, just a
// guard against the feeds that get this wrong or omit it.
function safeDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function extractBlocks(xml, tagName) {
  const re = new RegExp(`<${tagName}\\b[\\s\\S]*?</${tagName}>`, "gi");
  return (xml.match(re) ?? []).slice(0, MAX_ITEMS_PER_FEED);
}

// Sniffs the root element in the first slice of the document rather than
// trusting Content-Type, since real feeds routinely mislabel it as
// text/html or text/plain.
export function detectFormat(xml) {
  const head = xml.slice(0, 1000);
  if (/<feed[\s>]/i.test(head)) return "atom";
  if (/<rss[\s>]/i.test(head)) return "rss";
  if (/<rdf:rdf[\s>]/i.test(head)) return "rdf";
  return null;
}

export function parseRss(xml) {
  const title = cleanText(tagText(xml, "title"));
  const items = extractBlocks(xml, "item").map((item) => ({
    title: tagText(item, "title") || "(untitled)",
    link: tagText(item, "link"),
    date: safeDate(tagText(item, "pubDate")),
    description: makeExcerpt(tagText(item, "description")),
  }));
  return { title: title || "(untitled feed)", items };
}

export function parseAtom(xml) {
  const title = cleanText(tagText(xml, "title"));
  const items = extractBlocks(xml, "entry").map((entry) => ({
    title: tagText(entry, "title") || "(untitled)",
    link: atomLinkHref(entry),
    date: safeDate(tagText(entry, "updated") || tagText(entry, "published")),
    description: makeExcerpt(
      tagText(entry, "summary") || tagText(entry, "content"),
    ),
  }));
  return { title: title || "(untitled feed)", items };
}

// RSS 1.0/RDF is detected and explicitly rejected rather than silently
// returning nothing -- real-world feeds are overwhelmingly RSS 2.0 or
// Atom, and RDF support isn't worth the second parser.
export function parseFeed(xml) {
  const format = detectFormat(xml);
  if (format === "atom") return { format, ...parseAtom(xml) };
  if (format === "rss") return { format, ...parseRss(xml) };
  if (format === "rdf") {
    throw new RenderError(
      502,
      "unsupported_format",
      "RSS 1.0/RDF feeds are not supported",
    );
  }
  throw new RenderError(
    502,
    "unparseable_feed",
    "could not detect an RSS or Atom root element",
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

// The one impure function. Mirrors fetchLinkPreview's shape (timeout,
// capped read, honest bot User-Agent) but throws RenderError on failure
// instead of returning null -- the UI needs to know *which* feed broke
// so it can show that feed's own error state without discarding the
// others, unlike a failed link preview, which just degrades to a plain
// link inline in a note nobody else is subscribed to.
export async function fetchFeed(url) {
  if (!isFetchableUrl(url)) {
    throw new RenderError(400, "invalid_url", "not a fetchable http(s) URL");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "STATICWireBot/1.0 (+feed reader)",
        // Permissive: many real feeds mislabel their own content-type.
        Accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, */*",
      },
    });
    if (!res.ok) {
      throw new RenderError(
        502,
        "upstream_error",
        `feed responded ${res.status}`,
      );
    }
    const xml = await readCapped(res, MAX_FEED_BYTES);
    const parsed = parseFeed(xml);
    return { ...parsed, sourceUrl: res.url || url };
  } catch (error) {
    if (error instanceof RenderError) throw error;
    if (error.name === "AbortError") {
      throw new RenderError(502, "timeout", "feed took too long to respond");
    }
    throw new RenderError(502, "fetch_failed", error.message || "fetch failed");
  } finally {
    clearTimeout(timer);
  }
}
