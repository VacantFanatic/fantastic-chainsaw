// Serves the field notes at request time, reading them straight out of
// `main` on GitHub instead of out of the deployed build.
//
// This is the piece that decouples publishing from deploying. `publish.mjs`
// still commits real, final HTML to the repo exactly as before -- nothing
// about how a note is made changes. What changes is who hands that file to
// a reader: the CDN used to, having received it at build time, which meant
// a note wasn't live until the site rebuilt. Now this function fetches the
// committed file per request, so a note is live the moment it's committed
// and a deploy is only needed when a *page* or *function* changes.
//
// The static files stay in the repo and stay real. `git clone` and open
// still works, CI still link-checks them, and if this function is ever
// removed the site falls straight back to serving them from the build with
// no migration. This adds a serving path; it doesn't replace the files.
//
// Zero npm dependencies, like its siblings -- the GitHub Contents API over
// plain fetch. See CLAUDE.md, "Publishing does not require a deploy".

const GITHUB_API = "https://api.github.com";

// How long the CDN may serve a copy before checking back. The whole point
// is that a publish shows up without a deploy, so this is the delay
// between hitting publish and seeing the note -- but it's also what keeps
// a busy day from turning into a GitHub API call per pageview.
const CACHE_CONTROL = "public, max-age=30, stale-while-revalidate=300";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const BASE = "pages/field-notes";

const TYPES = {
  html: "text/html; charset=utf-8",
  json: "application/json; charset=utf-8",
  xml: "application/rss+xml; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

/* ---------------------------------------------------------
   Pure helper -- exported for unit testing (notes.test.mjs).
   --------------------------------------------------------- */

// Maps a requested URL path to the repo file that answers it, or null if
// nothing does. This is an allowlist, and the repo path is *rebuilt* from
// validated pieces rather than passed through from the request -- the
// function holds a token that can read the whole private repo, so "which
// files may this serve" is the one decision here that has to be airtight.
// No input reaches a path without matching SLUG first.
export function resolveFile(pathname) {
  const clean = decodeURIComponent(pathname || "").replace(/^\/+/, "");
  const rest = clean.startsWith(`${BASE}/`) ? clean.slice(BASE.length + 1) : "";

  if (rest === "field-notes.html") {
    return { path: `${BASE}/field-notes.html`, type: TYPES.html };
  }
  if (rest === "posts.json") {
    return { path: `${BASE}/posts.json`, type: TYPES.json };
  }
  if (rest === "feed.xml") {
    return { path: `${BASE}/feed.xml`, type: TYPES.xml };
  }

  const post = rest.match(/^posts\/([^/]+)\.html$/);
  if (post && SLUG.test(post[1])) {
    return { path: `${BASE}/posts/${post[1]}.html`, type: TYPES.html };
  }

  const source = rest.match(/^sources\/([^/]+)\.txt$/);
  if (source && SLUG.test(source[1])) {
    return { path: `${BASE}/sources/${source[1]}.txt`, type: TYPES.txt };
  }

  return null;
}

// Netlify can hand a rewritten request to a function in more than one
// shape depending on how the rewrite is declared, and none of it can be
// verified without deploying. So take the first signal that's actually
// present rather than betting on one: the explicit `?file=` the redirect
// in netlify.toml sets, then the original-path header Netlify attaches to
// a rewrite, then the request URL itself.
export function requestedPath(url, headers) {
  const parsed = new URL(url, "https://placeholder.invalid");
  const explicit = parsed.searchParams.get("file");
  if (explicit) return explicit;

  const original =
    headers?.get?.("x-nf-original-path") ?? headers?.get?.("x-original-path");
  if (original) return original.split("?")[0];

  return parsed.pathname;
}

/* ---------------------------------------------------------
   Handler
   --------------------------------------------------------- */

function text(status, body, extra = {}) {
  return new Response(body, {
    status,
    headers: { "Content-Type": TYPES.html, ...extra },
  });
}

export default async (req) => {
  const target = resolveFile(requestedPath(req.url, req.headers));
  if (!target) {
    return text(404, "<h1>404</h1><p>no such field note.</p>");
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    return text(500, "<h1>500</h1><p>field notes are not configured.</p>");
  }

  // The reader's own If-None-Match is forwarded to GitHub rather than
  // compared here: GitHub answers 304 for an unchanged file, and a 304
  // doesn't count against the API rate limit. The cheap path stays cheap
  // all the way down.
  const inbound = req.headers.get("if-none-match");

  const url = `${GITHUB_API}/repos/${repo}/contents/${target.path}?ref=main`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Hands back the file itself rather than JSON with base64 in it --
        // no decoding step, and no 1MB JSON ceiling.
        Accept: "application/vnd.github.raw",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "static-field-notes-serve-fn",
        ...(inbound ? { "If-None-Match": inbound } : {}),
      },
    });
  } catch (err) {
    return text(502, `<h1>502</h1><p>couldn't reach the notes.</p>`, {
      "X-Notes-Error": String(err).slice(0, 200),
    });
  }

  if (res.status === 304) {
    return new Response(null, {
      status: 304,
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  }
  if (res.status === 404) {
    return text(404, "<h1>404</h1><p>no such field note.</p>");
  }
  if (!res.ok) {
    return text(502, "<h1>502</h1><p>couldn't reach the notes.</p>", {
      "X-Notes-Error": `github ${res.status}`,
    });
  }

  const etag = res.headers.get("etag");
  return new Response(await res.text(), {
    status: 200,
    headers: {
      "Content-Type": target.type,
      "Cache-Control": CACHE_CONTROL,
      ...(etag ? { ETag: etag } : {}),
    },
  });
};

export const config = {
  path: [
    "/pages/field-notes/field-notes.html",
    "/pages/field-notes/posts.json",
    "/pages/field-notes/feed.xml",
    "/pages/field-notes/posts/:slug",
    "/pages/field-notes/sources/:slug",
  ],
};
