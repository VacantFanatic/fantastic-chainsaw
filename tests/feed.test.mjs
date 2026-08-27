// Unit tests for the RSS/Atom parser behind "the wire" -- the generator
// logic that can't otherwise be checked without a live feed to fetch.
//
// No network, no npm dependency, no database: node:test and node:assert
// are built in, and everything under test here is pure. fetchFeed is the
// one impure function and is intentionally untested here, matching the
// same accepted boundary render.test.mjs draws around fetchLinkPreview.
// Run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_ITEMS_PER_FEED,
  detectFormat,
  parseRss,
  parseAtom,
  parseFeed,
} from "../src/lib/feed.mjs";

/* ---------------------------------------------------------
   detectFormat
   --------------------------------------------------------- */

test("detectFormat: recognizes rss, atom, rdf, and unknown", () => {
  assert.equal(detectFormat("<rss><channel></channel></rss>"), "rss");
  assert.equal(
    detectFormat('<feed xmlns="http://www.w3.org/2005/Atom"></feed>'),
    "atom",
  );
  assert.equal(detectFormat("<rdf:RDF></rdf:RDF>"), "rdf");
  assert.equal(detectFormat("not xml at all"), null);
});

/* ---------------------------------------------------------
   parseRss
   --------------------------------------------------------- */

test("parseRss: extracts channel title and item fields", () => {
  const xml = `<rss version="2.0"><channel>
    <title>Example News</title>
    <item>
      <title>Breaking: Something Happened</title>
      <link>https://example.com/a</link>
      <pubDate>Wed, 26 Aug 2026 14:03:00 GMT</pubDate>
      <description>A short summary.</description>
    </item>
  </channel></rss>`;

  const result = parseRss(xml);
  assert.equal(result.title, "Example News");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].title, "Breaking: Something Happened");
  assert.equal(result.items[0].link, "https://example.com/a");
  assert.equal(result.items[0].date, "2026-08-26T14:03:00.000Z");
  assert.equal(result.items[0].description, "A short summary.");
});

test("parseRss: missing title falls back to '(untitled)'/'(untitled feed)'", () => {
  const xml = `<rss><channel><item><link>https://example.com/a</link></item></channel></rss>`;
  const result = parseRss(xml);
  assert.equal(result.title, "(untitled feed)");
  assert.equal(result.items[0].title, "(untitled)");
});

test("parseRss: malformed or missing pubDate becomes null, never throws", () => {
  const xml = `<rss><channel>
    <item><title>Bad date</title><pubDate>not a date</pubDate></item>
    <item><title>No date</title></item>
  </channel></rss>`;
  const result = parseRss(xml);
  assert.equal(result.items[0].date, null);
  assert.equal(result.items[1].date, null);
});

test("parseRss: caps items at MAX_ITEMS_PER_FEED", () => {
  const items = Array.from(
    { length: 30 },
    (_, i) => `<item><title>Item ${i}</title></item>`,
  ).join("");
  const xml = `<rss><channel><title>T</title>${items}</channel></rss>`;
  assert.equal(parseRss(xml).items.length, MAX_ITEMS_PER_FEED);
});

test("parseRss: unwraps CDATA and decodes entities in titles", () => {
  const xml = `<rss><channel>
    <title><![CDATA[Example News & Views]]></title>
    <item><title>Q&amp;A: things</title></item>
  </channel></rss>`;
  const result = parseRss(xml);
  assert.equal(result.title, "Example News & Views");
  assert.equal(result.items[0].title, "Q&A: things");
});

test("parseRss: strips HTML from both entity-escaped and CDATA-literal descriptions", () => {
  const xml = `<rss><channel>
    <item>
      <title>Entity-escaped</title>
      <description>&lt;p&gt;Some &lt;b&gt;bold&lt;/b&gt; text.&lt;/p&gt;</description>
    </item>
    <item>
      <title>Literal in CDATA</title>
      <description><![CDATA[<p>Literal <b>bold</b> text.</p>]]></description>
    </item>
  </channel></rss>`;
  const result = parseRss(xml);
  assert.equal(result.items[0].description, "Some bold text.");
  assert.equal(result.items[1].description, "Literal bold text.");
});

test("parseRss: decodes numeric HTML entities, not just named ones", () => {
  // Confirmed against a live NASA feed while building this parser: real
  // feeds lean on numeric character references for smart quotes/dashes
  // far more than the five named entities render.mjs's OG scraper needed.
  const xml = `<rss><channel><item>
    <title>NASA&#8217;s mission</title>
    <description>caf&#233; &#x2014; unicode by hex too</description>
  </item></channel></rss>`;
  const result = parseRss(xml);
  assert.equal(result.items[0].title, "NASA’s mission");
  assert.equal(result.items[0].description, "café — unicode by hex too");
});

test("parseRss: strips HTML from titles too, not just descriptions", () => {
  const xml = `<rss><channel><item><title>&lt;b&gt;Bold&lt;/b&gt; Title</title></item></channel></rss>`;
  assert.equal(parseRss(xml).items[0].title, "Bold Title");
});

/* ---------------------------------------------------------
   parseAtom
   --------------------------------------------------------- */

test("parseAtom: extracts feed title and entry fields", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
    <title>Atom Example</title>
    <entry>
      <title>Atom Entry One</title>
      <link rel="alternate" href="https://example.com/entry1"/>
      <updated>2026-08-26T14:03:00Z</updated>
      <summary>An atom summary.</summary>
    </entry>
  </feed>`;

  const result = parseAtom(xml);
  assert.equal(result.title, "Atom Example");
  assert.equal(result.items[0].title, "Atom Entry One");
  assert.equal(result.items[0].link, "https://example.com/entry1");
  assert.equal(result.items[0].date, "2026-08-26T14:03:00.000Z");
  assert.equal(result.items[0].description, "An atom summary.");
});

test("parseAtom: prefers rel=alternate over other link relations", () => {
  const xml = `<feed>
    <title>T</title>
    <entry>
      <title>E</title>
      <link rel="self" href="https://example.com/self"/>
      <link rel="alternate" href="https://example.com/alt"/>
    </entry>
  </feed>`;
  assert.equal(parseAtom(xml).items[0].link, "https://example.com/alt");
});

test("parseAtom: falls back to the first link when none is rel=alternate", () => {
  const xml = `<feed><title>T</title>
    <entry><title>E</title><link rel="self" href="https://example.com/self"/></entry>
  </feed>`;
  assert.equal(parseAtom(xml).items[0].link, "https://example.com/self");
});

test("parseAtom: falls back to published when updated is absent", () => {
  const xml = `<feed><title>T</title>
    <entry><title>E</title><published>2026-08-20T00:00:00Z</published></entry>
  </feed>`;
  assert.equal(parseAtom(xml).items[0].date, "2026-08-20T00:00:00.000Z");
});

test("parseAtom: falls back to content when summary is absent", () => {
  const xml = `<feed><title>T</title>
    <entry><title>E</title><content>Full content here.</content></entry>
  </feed>`;
  assert.equal(parseAtom(xml).items[0].description, "Full content here.");
});

test("parseAtom: caps entries at MAX_ITEMS_PER_FEED", () => {
  const entries = Array.from(
    { length: 30 },
    (_, i) => `<entry><title>Entry ${i}</title></entry>`,
  ).join("");
  const xml = `<feed><title>T</title>${entries}</feed>`;
  assert.equal(parseAtom(xml).items.length, MAX_ITEMS_PER_FEED);
});

/* ---------------------------------------------------------
   parseFeed (format dispatch)
   --------------------------------------------------------- */

test("parseFeed: dispatches rss and atom to the right parser", () => {
  const rss = `<rss><channel><title>R</title></channel></rss>`;
  const atom = `<feed><title>A</title></feed>`;
  assert.equal(parseFeed(rss).format, "rss");
  assert.equal(parseFeed(rss).title, "R");
  assert.equal(parseFeed(atom).format, "atom");
  assert.equal(parseFeed(atom).title, "A");
});

test("parseFeed: throws unsupported_format for RSS 1.0/RDF", () => {
  assert.throws(
    () => parseFeed("<rdf:RDF></rdf:RDF>"),
    (err) => err.code === "unsupported_format" && err.status === 502,
  );
});

test("parseFeed: throws unparseable_feed for unrecognized input", () => {
  assert.throws(
    () => parseFeed("not xml at all"),
    (err) => err.code === "unparseable_feed" && err.status === 502,
  );
});
