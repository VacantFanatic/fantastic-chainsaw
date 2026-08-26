// Unit tests for the field note renderer -- the plain-text-in, HTML-out
// logic that survived the move from static files to Astro + Supabase
// untouched. Same assertions as before that move; only the import changed.
//
// No network, no npm dependency, no database: node:test and node:assert
// are built in, and everything under test is pure. Run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slugify,
  uniqueSlug,
  escapeHtml,
  escapeXml,
  cdata,
  renderBody,
  humanDate,
  rfc822,
  makeExcerpt,
  extractStandaloneLinks,
  parseOgTags,
  isFetchableUrl,
} from "../src/lib/render.mjs";

test("slugify: lowercases, strips punctuation, collapses to dashes", () => {
  assert.equal(
    slugify("Café au lait — a morning ritual!"),
    "cafe-au-lait-a-morning-ritual",
  );
  assert.equal(slugify("  Hello, World!!  "), "hello-world");
  assert.equal(slugify("已经存在"), "post"); // no latin chars left after stripping
  assert.equal(slugify(""), "post");
});

test("slugify: truncates to 80 chars", () => {
  const long = "a".repeat(200);
  assert.equal(slugify(long).length, 80);
});

test("uniqueSlug: returns base when free", () => {
  assert.equal(uniqueSlug("hello", []), "hello");
});

test("uniqueSlug: appends -2, -3, ... on collision", () => {
  const posts = [{ slug: "hello" }, { slug: "hello-2" }];
  assert.equal(uniqueSlug("hello", posts), "hello-3");
});

test("uniqueSlug: throws PublishError after 25 attempts", () => {
  const posts = [
    { slug: "x" },
    ...Array.from({ length: 24 }, (_, i) => ({ slug: `x-${i + 2}` })),
  ];
  assert.throws(
    () => uniqueSlug("x", posts),
    (err) => err.code === "slug_collision" && err.status === 409,
  );
});

test("escapeHtml: escapes all five special characters", () => {
  assert.equal(
    escapeHtml(`<b>a & "b" 'c'</b>`),
    "&lt;b&gt;a &amp; &quot;b&quot; &#39;c&#39;&lt;/b&gt;",
  );
});

test("escapeXml: escapes only &, <, > (not quotes)", () => {
  assert.equal(
    escapeXml(`<a href="x">a & "b"</a>`),
    `&lt;a href="x"&gt;a &amp; "b"&lt;/a&gt;`,
  );
});

test("cdata: wraps text, splits a ]]> sequence", () => {
  assert.equal(cdata("hello"), "<![CDATA[hello]]>");
  assert.equal(cdata("a]]>b"), "<![CDATA[a]]]]><![CDATA[>b]]>");
});

test("renderBody: blank line separates paragraphs, single newline becomes <br />", () => {
  const out = renderBody("first line\nsecond line\n\nsecond para");
  assert.equal(out, "<p>first line<br />\nsecond line</p>\n<p>second para</p>");
});

test("renderBody: escapes HTML inside paragraphs", () => {
  assert.equal(
    renderBody("<script>alert(1)</script>"),
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
  );
});

test("humanDate: formats as Month D, YYYY in UTC", () => {
  assert.equal(humanDate("2026-08-26T14:03:00.000Z"), "August 26, 2026");
});

test("rfc822: matches RSS's RFC 1123 pubDate form", () => {
  assert.equal(
    rfc822("2026-08-26T14:03:00.000Z"),
    "Wed, 26 Aug 2026 14:03:00 GMT",
  );
});

test("makeExcerpt: returns short text unchanged", () => {
  assert.equal(makeExcerpt("a short note"), "a short note");
});

test("makeExcerpt: truncates long text at a word boundary with an ellipsis", () => {
  const long = "word ".repeat(60).trim();
  const excerpt = makeExcerpt(long);
  assert.ok(excerpt.length <= 161);
  assert.ok(excerpt.endsWith("…"));
  assert.ok(!excerpt.slice(0, -1).endsWith(" "));
});

test("makeExcerpt: collapses internal whitespace/newlines", () => {
  assert.equal(makeExcerpt("line one\n\nline   two"), "line one line two");
});

/* ---------------------------------------------------------
   Link previews
   --------------------------------------------------------- */

test("extractStandaloneLinks: finds paragraphs that are exactly one URL", () => {
  const body =
    "intro\n\nhttps://example.com/a\n\nmiddle with an inline https://x.example.com link\n\nhttps://example.com/b";
  assert.deepEqual(extractStandaloneLinks(body), [
    "https://example.com/a",
    "https://example.com/b",
  ]);
});

test("extractStandaloneLinks: dedupes repeated links", () => {
  const body = "https://example.com/a\n\nhttps://example.com/a";
  assert.deepEqual(extractStandaloneLinks(body), ["https://example.com/a"]);
});

test("extractStandaloneLinks: caps at 5", () => {
  const body = Array.from(
    { length: 8 },
    (_, i) => `https://example.com/${i}`,
  ).join("\n\n");
  assert.equal(extractStandaloneLinks(body).length, 5);
});

test("extractStandaloneLinks: ignores non-URL paragraphs and inline URLs", () => {
  const body = "just text\n\nhttps://example.com/a and more text";
  assert.deepEqual(extractStandaloneLinks(body), []);
});

test("isFetchableUrl: accepts http/https, rejects other schemes", () => {
  assert.equal(isFetchableUrl("https://example.com"), true);
  assert.equal(isFetchableUrl("http://example.com"), true);
  assert.equal(isFetchableUrl("ftp://example.com"), false);
  assert.equal(isFetchableUrl("javascript:alert(1)"), false);
  assert.equal(isFetchableUrl("not a url"), false);
});

test("isFetchableUrl: rejects localhost and private IP ranges", () => {
  assert.equal(isFetchableUrl("http://localhost:3000"), false);
  assert.equal(isFetchableUrl("http://127.0.0.1"), false);
  assert.equal(isFetchableUrl("http://10.0.0.5"), false);
  assert.equal(isFetchableUrl("http://192.168.1.1"), false);
  assert.equal(isFetchableUrl("http://172.16.0.1"), false);
  assert.equal(isFetchableUrl("http://172.31.255.255"), false);
  assert.equal(isFetchableUrl("http://172.32.0.1"), true); // just outside the private range
});

test("parseOgTags: prefers og:title/og:description/og:image, decodes entities", () => {
  const html = `<html><head>
    <title>Fallback Title</title>
    <meta property="og:title" content="A Great Article &amp; Things" />
    <meta property="og:description" content="Some description." />
    <meta property="og:image" content="/img/thumb.png" />
  </head></html>`;
  const result = parseOgTags(html, "https://example.com/post");
  assert.equal(result.title, "A Great Article & Things");
  assert.equal(result.description, "Some description.");
  assert.equal(result.image, "https://example.com/img/thumb.png");
});

test("parseOgTags: falls back to <title> when there's no og:title", () => {
  const html = "<html><head><title>Just A Title</title></head></html>";
  const result = parseOgTags(html, "https://example.com/x");
  assert.equal(result.title, "Just A Title");
  assert.equal(result.description, "");
  assert.equal(result.image, "");
});

test("parseOgTags: returns null when there's no usable title at all", () => {
  assert.equal(
    parseOgTags("<html><head></head></html>", "https://x.com"),
    null,
  );
});

test("parseOgTags: resolves an absolute og:image unchanged", () => {
  const html = `<meta property="og:image" content="https://cdn.example.com/a.png" /><title>T</title>`;
  const result = parseOgTags(html, "https://example.com/post");
  assert.equal(result.image, "https://cdn.example.com/a.png");
});

test("renderBody: standalone link with a preview renders a full card", () => {
  const previews = new Map([
    [
      "https://example.com/a",
      {
        title: "A Title",
        description: "A description",
        image: "https://example.com/thumb.png",
      },
    ],
  ]);
  const html = renderBody("https://example.com/a", previews);
  assert.ok(html.includes('class="link-card"'));
  assert.ok(html.includes("A Title"));
  assert.ok(html.includes("A description"));
  assert.ok(html.includes('src="https://example.com/thumb.png"'));
  assert.ok(html.includes("example.com"));
});

test("renderBody: standalone link with no preview renders the plain fallback card", () => {
  const previews = new Map([["https://example.com/a", null]]);
  const html = renderBody("https://example.com/a", previews);
  assert.ok(html.includes('class="link-card link-card--plain"'));
  assert.ok(!html.includes("link-card__title"));
});

test("renderBody: standalone link missing from the previews map also falls back", () => {
  const html = renderBody("https://example.com/a", new Map());
  assert.ok(html.includes('class="link-card link-card--plain"'));
});

test("renderBody: a URL inline within a sentence is auto-linked, not carded", () => {
  const html = renderBody("check this out https://example.com/a for real");
  assert.ok(
    html.includes('<a href="https://example.com/a">https://example.com/a</a>'),
  );
  assert.ok(!html.includes("link-card"));
});

test("renderBody: inline URL is escaped and excludes trailing punctuation", () => {
  const html = renderBody("see https://example.com/a?x=1&y=2.");
  assert.ok(html.includes('href="https://example.com/a?x=1&amp;y=2"'));
  assert.ok(html.endsWith(".</p>"));
});

test("renderBody: card content is HTML-escaped", () => {
  const previews = new Map([
    [
      "https://example.com/a",
      { title: "<script>alert(1)</script>", description: "", image: "" },
    ],
  ]);
  const html = renderBody("https://example.com/a", previews);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
});
