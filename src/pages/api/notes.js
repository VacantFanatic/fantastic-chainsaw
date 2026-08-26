// Write endpoints for field notes: create, revise, and change status.
//
// Every one of them runs as the signed-in admin's own Supabase session, so
// row-level security is the thing that actually authorises the write. The
// currentAdmin() check here is a courtesy -- it turns "the database
// refused you" into a clean 401 -- not the security boundary. If this file
// forgot to check, the database would still say no.
export const prerender = false;

import { supabaseFor, currentAdmin, isConfigured } from "../../lib/supabase.js";
import { createNote, updateNote, setStatus } from "../../lib/notes.js";
import { RenderError } from "../../lib/render.mjs";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function withAdmin(request, cookies, handler) {
  if (!isConfigured()) return json(500, { error: "not_configured" });

  const supabase = supabaseFor(cookies, request.url);
  const admin = await currentAdmin(supabase);
  if (!admin) return json(401, { error: "unauthorized" });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  try {
    return await handler(supabase, payload ?? {});
  } catch (error) {
    if (error instanceof RenderError) {
      return json(error.status, { error: error.code, detail: error.message });
    }
    console.error("[api/notes] unexpected:", error);
    return json(500, { error: "unexpected_error" });
  }
}

// Create.
export const POST = ({ request, cookies }) =>
  withAdmin(request, cookies, async (supabase, { title, body }) => {
    const note = await createNote(supabase, title, body);
    return json(200, { ok: true, note });
  });

// Revise. The slug and published_at are never touched -- see notes.js.
export const PUT = ({ request, cookies }) =>
  withAdmin(request, cookies, async (supabase, { slug, title, body }) => {
    if (typeof slug !== "string" || !slug) {
      return json(400, { error: "missing_slug" });
    }
    const note = await updateNote(supabase, slug, title, body);
    return json(200, { ok: true, note });
  });

// Publish or unpublish. Unpublishing is reversible: the row becomes a
// draft rather than disappearing.
export const PATCH = ({ request, cookies }) =>
  withAdmin(request, cookies, async (supabase, { slug, status }) => {
    if (typeof slug !== "string" || !slug) {
      return json(400, { error: "missing_slug" });
    }
    const note = await setStatus(supabase, slug, status);
    return json(200, { ok: true, note });
  });
