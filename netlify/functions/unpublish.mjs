// The other half of the one backend piece -- the undo for publish.mjs.
// A secret-gated endpoint that takes a slug, drops that field note from
// the manifest, regenerates the listing and the feed without it, and
// deletes its page -- all in a single commit on `main`.
//
// Everything it renders and every GitHub call it makes comes from
// publish.mjs, so the two endpoints can never drift into producing
// different listing or feed markup. Same rules apply: zero npm
// dependencies, only built-in Node/Fetch APIs. See CLAUDE.md.

import {
  GitHubApiError,
  ghCommit,
  ghGetFile,
  json,
  renderFeed,
  renderListingPage,
  secretIsValid,
  sourcePath,
} from "./publish.mjs";

/* ---------------------------------------------------------
   Pure helper -- exported for unit testing (unpublish.test.mjs).
   --------------------------------------------------------- */

// Returns the manifest without `slug`, plus the entry that was removed
// (null if there was no such post). Splitting the lookup and the filter
// into one pass keeps "did it exist?" and "what's left?" from ever
// disagreeing about which slug matched.
export function removePost(posts, slug) {
  const removed = posts.find((p) => p.slug === slug) ?? null;
  return { removed, remaining: posts.filter((p) => p.slug !== slug) };
}

/* ---------------------------------------------------------
   Handler
   --------------------------------------------------------- */

export default async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const { slug, secret } = payload ?? {};

  if (!secretIsValid(secret)) {
    return json(401, { error: "unauthorized" });
  }

  // The slug is interpolated straight into a repo path, so it gets the
  // same shape publish.mjs's slugify() guarantees and nothing else --
  // no dots, no slashes, nothing that could climb out of posts/.
  if (typeof slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return json(400, {
      error: "invalid_slug",
      detail: "slug must be lowercase alphanumeric words separated by dashes",
    });
  }

  const repo = process.env.GITHUB_REPOSITORY;
  const siteUrl = process.env.URL;
  if (!repo || !process.env.GITHUB_TOKEN) {
    return json(500, { error: "server_misconfigured" });
  }
  if (!siteUrl) {
    return json(500, { error: "site_url_unconfigured" });
  }

  try {
    const manifest = await ghGetFile(repo, "pages/field-notes/posts.json");
    const posts = manifest ? JSON.parse(manifest) : [];

    const { removed, remaining } = removePost(posts, slug);
    if (!removed) {
      return json(404, {
        error: "not_found",
        detail: `no published note with slug "${slug}"`,
      });
    }

    // A file that's already missing -- hand-deleted, or a note published
    // before sources were kept -- is not an error here. The tree API
    // rejects a delete for a path it can't find, so ask first and skip
    // that entry; the manifest still gets cleaned up either way.
    const pagePath = `pages/field-notes/posts/${slug}.html`;
    const doomed = await Promise.all(
      [pagePath, sourcePath(slug)].map(async (path) =>
        (await ghGetFile(repo, path)) === null ? null : path,
      ),
    );

    // The mirror image of a publish: the same three generated files,
    // regenerated without the note, plus the note's own page and source
    // removed, all in one commit. One push, one Netlify build, and never
    // a moment where the listing or the feed points at a page that's
    // already gone.
    await ghCommit(repo, `field notes: unpublish "${removed.title}"`, [
      ...doomed.filter(Boolean).map((path) => ({ path, content: null })),
      {
        path: "pages/field-notes/posts.json",
        content: `${JSON.stringify(remaining, null, 2)}\n`,
      },
      {
        path: "pages/field-notes/field-notes.html",
        content: renderListingPage(remaining),
      },
      {
        path: "pages/field-notes/feed.xml",
        content: renderFeed(remaining, siteUrl),
      },
    ]);

    return json(200, {
      ok: true,
      slug,
      title: removed.title,
      remaining: remaining.length,
    });
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return json(502, {
        error: "github_api_error",
        step: err.step,
        status: err.status,
        detail: err.detail,
      });
    }
    return json(500, { error: "unexpected_error", detail: String(err) });
  }
};

export const config = { path: "/api/unpublish" };
