// The third face of the one backend piece: revise a field note that's
// already published. Takes a slug plus a new title and body, re-renders
// that note's page from scratch, and commits it alongside the manifest,
// listing and feed in a single commit on `main`.
//
// The slug and the original publication date never change -- a published
// URL is a promise, and an edit is not a republish. Everything it renders
// and every GitHub call it makes comes from publish.mjs, so an edited note
// is byte-for-byte what publishing the same text would have produced.
// Same rules as its siblings: zero npm dependencies. See CLAUDE.md.

import {
  GitHubApiError,
  extractStandaloneLinks,
  fetchLinkPreviews,
  ghCommit,
  ghGetFile,
  json,
  makeExcerpt,
  renderFeed,
  renderListingPage,
  renderPostPage,
  secretIsValid,
  sourcePath,
} from "./publish.mjs";

/* ---------------------------------------------------------
   Pure helper -- exported for unit testing (edit.test.mjs).
   --------------------------------------------------------- */

// Returns the manifest with `slug`'s entry rewritten in place, plus that
// updated entry (null if there was no such post). In place matters: the
// listing and the feed are ordered by the array, so an edit must not
// bump a two-year-old note to the top of the page.
export function applyEdit(posts, slug, { title, excerpt }) {
  let updated = null;
  const next = posts.map((post) => {
    if (post.slug !== slug) return post;
    updated = { ...post, title, excerpt };
    return updated;
  });
  return { updated, posts: updated ? next : posts };
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

  const { slug, title, body, secret } = payload ?? {};

  if (!secretIsValid(secret)) {
    return json(401, { error: "unauthorized" });
  }

  // Same guard as unpublish.mjs: the slug goes straight into repo paths,
  // so it gets exactly the shape slugify() produces and nothing else.
  if (typeof slug !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return json(400, {
      error: "invalid_slug",
      detail: "slug must be lowercase alphanumeric words separated by dashes",
    });
  }
  if (
    typeof title !== "string" ||
    typeof body !== "string" ||
    title.trim() === "" ||
    body.trim() === ""
  ) {
    return json(400, {
      error: "missing_fields",
      detail: "title and body are required",
    });
  }
  if (title.length > 200 || body.length > 20000) {
    return json(400, { error: "too_long" });
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

    const { updated, posts: newPosts } = applyEdit(posts, slug, {
      title,
      excerpt: makeExcerpt(body),
    });
    if (!updated) {
      return json(404, {
        error: "not_found",
        detail: `no published note with slug "${slug}"`,
      });
    }

    // Previews are re-fetched rather than scraped back out of the old
    // page: an edit can add, remove or reorder links, and a card built
    // from today's copy of the target page is the same thing publishing
    // this text fresh would have produced.
    const previews = await fetchLinkPreviews(extractStandaloneLinks(body));

    await ghCommit(repo, `field notes: edit "${updated.title}"`, [
      {
        path: `pages/field-notes/posts/${slug}.html`,
        content: renderPostPage(updated, body, previews),
      },
      { path: sourcePath(slug), content: `${body.trim()}\n` },
      {
        path: "pages/field-notes/posts.json",
        content: `${JSON.stringify(newPosts, null, 2)}\n`,
      },
      {
        path: "pages/field-notes/field-notes.html",
        content: renderListingPage(newPosts),
      },
      {
        path: "pages/field-notes/feed.xml",
        content: renderFeed(newPosts, siteUrl),
      },
    ]);

    return json(200, {
      ok: true,
      slug,
      title: updated.title,
      url: `${siteUrl}/pages/field-notes/posts/${slug}.html`,
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

export const config = { path: "/api/edit" };
