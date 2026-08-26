// Sign in and out. The whole of authentication, in one small file.
//
// What replaced the shared secret: a real Supabase Auth user with a
// password Supabase stores hashed, a session in an httpOnly cookie the
// page's own JavaScript cannot read, and a token this server verifies with
// Supabase on every request rather than trusting the cookie's word.
//
// CSRF: the session cookie is sameSite=lax, so a form on another origin
// cannot cause the browser to attach it to a POST here.
export const prerender = false;

import { supabaseFor, isConfigured } from "../../lib/supabase.js";

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST({ request, cookies }) {
  if (!isConfigured()) return json(500, { error: "not_configured" });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const supabase = supabaseFor(cookies, request.url);
  const { action, email, password } = payload ?? {};

  if (action === "logout") {
    await supabase.auth.signOut();
    return json(200, { ok: true });
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return json(400, { error: "missing_fields" });
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague, and identical for "no such user" and "wrong
    // password": a login form is a place people enumerate accounts.
    return json(401, { error: "invalid_credentials" });
  }

  return json(200, { ok: true });
}
