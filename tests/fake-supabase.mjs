// A stand-in for Supabase: just enough GoTrue and PostgREST to drive the
// real application end to end without a network or an account.
//
// This exists because the previous attempt at this feature shipped broken.
// Unit tests said it worked; nothing had actually served a page. So the
// integration test runs the real Astro server against this, signs in for
// real, publishes for real, and reads the rendered HTML back.
//
// It is a test double, not a Supabase implementation. It enforces the
// parts of row-level security the app depends on (anonymous callers see
// only published notes; writes require an admin session) so that a
// regression in the app's own auth handling actually fails a test rather
// than quietly passing.

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

// One token per user, not one shared token. The first version of this
// file handed the same string to everybody, which made a real bug -- a
// signed-in non-admin being able to publish -- look like a fake-server
// artefact. A test double that can't tell two users apart cannot test
// authorisation at all.
const tokenFor = (user) => `fake-access-token-${user.id}`;
const REFRESH_TOKEN = "fake-refresh-token";

export function startFakeSupabase({
  port = 54321,
  users = [],
  notes = [],
} = {}) {
  const state = {
    users: users.map((u) => ({ id: randomUUID(), ...u })),
    notes: [...notes],
    requests: [],
  };

  const json = (res, status, body, headers = {}) => {
    const payload = body === null ? "" : JSON.stringify(body);
    res.writeHead(status, {
      "Content-Type": "application/json",
      ...headers,
    });
    res.end(payload);
  };

  // PostgREST filters arrive as `column=op.value`. Only the handful of
  // operators this app uses are supported; anything else is a loud failure
  // rather than a silently ignored filter, which would make a test pass
  // for the wrong reason.
  const applyFilters = (rows, params) => {
    let out = rows;
    for (const [key, raw] of params) {
      if (["select", "order", "limit", "offset"].includes(key)) continue;
      const [op, ...rest] = raw.split(".");
      const value = rest.join(".");
      if (op !== "eq") throw new Error(`fake-supabase: unsupported op "${op}"`);
      out = out.filter((row) => String(row[key]) === value);
    }
    return out;
  };

  const applyOrder = (rows, params) => {
    const order = params.get("order");
    if (!order) return rows;
    const [column, direction] = order.split(".");
    const sorted = [...rows].sort((a, b) =>
      String(a[column]).localeCompare(String(b[column])),
    );
    return direction === "desc" ? sorted.reverse() : sorted;
  };

  const bearer = (req) => {
    const header = req.headers.authorization ?? "";
    return header.startsWith("Bearer ") ? header.slice(7) : "";
  };

  // The only identity check. A request is an admin session if it carries
  // the access token issued by /auth/v1/token; the anon key is not enough.
  const sessionUser = (req) => {
    const token = bearer(req);
    return state.users.find((u) => tokenFor(u) === token) ?? null;
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const params = [...url.searchParams.entries()];
    state.requests.push(`${req.method} ${url.pathname}`);

    let body = "";
    for await (const chunk of req) body += chunk;
    const parsed = body ? JSON.parse(body) : null;

    /* ------------------------------------------------------------ auth */

    if (url.pathname === "/auth/v1/token") {
      const user = state.users.find(
        (u) => u.email === parsed?.email && u.password === parsed?.password,
      );
      if (!user) {
        return json(res, 400, {
          error: "invalid_grant",
          error_description: "Invalid login credentials",
        });
      }
      return json(res, 200, {
        access_token: tokenFor(user),
        refresh_token: REFRESH_TOKEN,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: user.id, email: user.email, aud: "authenticated" },
      });
    }

    if (url.pathname === "/auth/v1/user") {
      const user = sessionUser(req);
      if (!user) return json(res, 401, { message: "invalid claim" });
      return json(res, 200, {
        id: user.id,
        email: user.email,
        aud: "authenticated",
        role: "authenticated",
      });
    }

    if (url.pathname === "/auth/v1/logout") {
      return json(res, 204, null);
    }

    /* -------------------------------------------------------- postgrest */

    if (url.pathname === "/rest/v1/admins") {
      const user = sessionUser(req);
      // RLS: only an authenticated user can see their own admins row.
      const rows =
        user && user.isAdmin ? [{ user_id: user.id, email: user.email }] : [];
      const found = applyFilters(rows, params);
      return respondRows(res, req, found);
    }

    if (url.pathname === "/rest/v1/notes") {
      const user = sessionUser(req);
      const isAdmin = Boolean(user?.isAdmin);

      if (req.method === "GET") {
        // RLS: anonymous callers never see drafts.
        const visible = isAdmin
          ? state.notes
          : state.notes.filter((n) => n.status === "published");
        return respondRows(
          res,
          req,
          applyOrder(applyFilters(visible, params), url.searchParams),
        );
      }

      if (req.method === "POST") {
        if (!isAdmin) return json(res, 401, { message: "permission denied" });
        const row = {
          id: randomUUID(),
          excerpt: "",
          link_previews: {},
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...parsed,
        };
        if (state.notes.some((n) => n.slug === row.slug)) {
          return json(res, 409, {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          });
        }
        state.notes.push(row);
        return respondRows(res, req, [row], 201);
      }

      if (req.method === "PATCH") {
        if (!isAdmin) return json(res, 401, { message: "permission denied" });
        const targets = applyFilters(state.notes, params);
        for (const row of targets) {
          Object.assign(row, parsed, { updated_at: new Date().toISOString() });
        }
        return respondRows(res, req, targets);
      }
    }

    json(res, 404, { message: `fake-supabase: no route for ${url.pathname}` });
  });

  // PostgREST returns a bare object rather than an array when the caller
  // asks for one, which is what .single()/.maybeSingle() do.
  function respondRows(res, req, rows, status = 200) {
    const wantsObject = (req.headers.accept ?? "").includes(
      "application/vnd.pgrst.object+json",
    );
    if (!wantsObject) return json(res, status, rows);
    if (rows.length === 1) return json(res, status, rows[0]);
    return json(res, rows.length === 0 ? 406 : 406, {
      code: "PGRST116",
      message: `JSON object requested, multiple (or no) rows returned`,
    });
  }

  return new Promise((resolve, reject) => {
    // Fail loudly on a port clash. Without this the promise simply never
    // settles and the caller hangs, which is a miserable way to find out
    // a previous run didn't shut down.
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve({
        state,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(r)),
      });
    });
  });
}
