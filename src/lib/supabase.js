// Supabase clients, and the one place a request is turned into an identity.
//
// There is deliberately no service-role key in this application. Every
// query runs either anonymously or as the signed-in admin's own session,
// so row-level security in the database is what decides what a request may
// see or change. A bug in this code cannot hand out write access the
// database hasn't already granted.

import { createServerClient } from "@supabase/ssr";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export class ConfigError extends Error {}

export function isConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function projectRef() {
  try {
    return new URL(SUPABASE_URL).hostname.split(".")[0];
  } catch {
    return "unknown";
  }
}

// Supabase names its session cookie after the project ref and splits it
// into numbered chunks once it outgrows the per-cookie size limit. Every
// shape has to be offered back or the session silently fails to restore.
function sessionCookieNames() {
  const base = `sb-${projectRef()}-auth-token`;
  return [base, `${base}.0`, `${base}.1`, `${base}.2`, `${base}.3`];
}

// Builds a request-scoped client from Astro's `cookies` and the request
// URL. The session, if there is one, comes from the cookies.
//
// httpOnly and sameSite are forced on rather than left to the caller: the
// session cookie must never be readable from client-side JavaScript.
// `secure` follows the request scheme so a plain-http localhost dev server
// still works, while anything served over https gets it.
export function supabaseFor(cookies, requestUrl) {
  if (!isConfigured()) {
    throw new ConfigError(
      "PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY are not set",
    );
  }

  let isHttps = true;
  try {
    isHttps = new URL(requestUrl).protocol === "https:";
  } catch {
    // No usable URL: assume https, which is the safer default.
  }

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        const found = [];
        for (const name of sessionCookieNames()) {
          const cookie = cookies.get(name);
          if (cookie?.value) found.push({ name, value: cookie.value });
        }
        return found;
      },
      setAll(list) {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: isHttps,
          });
        }
      },
    },
  });
}

// Returns the signed-in admin, or null.
//
// Two separate questions, both of which have to be answered yes. Is this a
// real, currently-valid user -- getUser() verifies the token with Supabase
// rather than trusting whatever the cookie claims. And is that user an
// admin: a perfectly valid non-admin account gets null, because being
// signed in is not authorisation.
export async function currentAdmin(supabase) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !data) return null;
  return user;
}
