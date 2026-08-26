// The RSS feed, rendered per request like everything else here so a new
// note reaches subscribers without a deploy.
export const prerender = false;

import { supabaseFor, isConfigured } from "../../lib/supabase.js";
import { listPublished } from "../../lib/notes.js";
import { cdata, escapeHtml, escapeXml, rfc822 } from "../../lib/render.mjs";

export async function GET({ cookies, request, site }) {
  if (!isConfigured()) {
    return new Response("Not configured", { status: 503 });
  }

  const base = (site?.href ?? new URL(request.url).origin).replace(/\/$/, "");

  let notes = [];
  try {
    notes = await listPublished(supabaseFor(cookies, request.url));
  } catch (error) {
    console.error("[field-notes] feed failed:", error);
    return new Response("Temporarily unavailable", { status: 503 });
  }

  const items = notes
    .map((note) => {
      const link = `${base}/field-notes/${note.slug}`;
      return `    <item>
      <title>${escapeXml(note.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rfc822(note.published_at)}</pubDate>
      <description>${cdata(escapeHtml(note.excerpt))}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>STATIC — field notes</title>
    <link>${base}/field-notes</link>
    <description>long-form notes, plain text, newest first.</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
