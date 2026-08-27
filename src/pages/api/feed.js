// Fetches and parses one RSS/Atom feed on request. The CORS-proxy "the
// wire" needs, since most feed servers don't send CORS headers a browser
// would accept for a direct fetch.
//
// No auth, no cookies, no Supabase -- unlike every other route in this
// directory. That's deliberate: this route reads no database and writes
// nothing, it's a stateless pass-through to a URL the caller already
// supplied, so there's nothing here for a session to gate.
export const prerender = false;

import { fetchFeed } from "../../lib/feed.mjs";
import { RenderError } from "../../lib/render.mjs";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET({ url }) {
  const feedUrl = url.searchParams.get("url");
  if (!feedUrl) return json(400, { error: "missing_url" });

  try {
    const feed = await fetchFeed(feedUrl);
    return json(200, { ok: true, feed });
  } catch (error) {
    if (error instanceof RenderError) {
      return json(error.status, { error: error.code, detail: error.message });
    }
    console.error("[api/feed] unexpected:", error);
    return json(500, { error: "unexpected_error" });
  }
}
