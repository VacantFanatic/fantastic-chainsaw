// Unit tests for notes.mjs's pure helpers -- the request-time server that
// hands out field notes read from git instead of from the build.
//
// resolveFile is the security boundary of that function: it holds a token
// that can read the whole private repo, and what it agrees to serve is
// decided entirely here. So the refusals matter more than the successes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFile, requestedPath } from "../netlify/functions/notes.mjs";

/* ------------------------------------------------------ what it serves */

test("resolveFile: the listing, manifest and feed", () => {
  assert.deepEqual(resolveFile("/pages/field-notes/field-notes.html"), {
    path: "pages/field-notes/field-notes.html",
    type: "text/html; charset=utf-8",
  });
  assert.equal(
    resolveFile("/pages/field-notes/posts.json").type,
    "application/json; charset=utf-8",
  );
  assert.equal(
    resolveFile("/pages/field-notes/feed.xml").type,
    "application/rss+xml; charset=utf-8",
  );
});

test("resolveFile: a post page and its source", () => {
  assert.equal(
    resolveFile("/pages/field-notes/posts/hell-yeah-brother.html").path,
    "pages/field-notes/posts/hell-yeah-brother.html",
  );
  assert.equal(
    resolveFile("/pages/field-notes/sources/mt-joy-2.txt").type,
    "text/plain; charset=utf-8",
  );
});

test("resolveFile: tolerates a missing leading slash", () => {
  assert.equal(
    resolveFile("pages/field-notes/posts.json").path,
    "pages/field-notes/posts.json",
  );
});

/* ----------------------------------------------------- what it refuses */

// The function's token can read the entire private repo. Everything below
// is a path that must never resolve, however it's dressed up.
test("resolveFile: refuses anything outside pages/field-notes", () => {
  for (const path of [
    "/netlify/functions/publish.mjs",
    "/.env",
    "/index.html",
    "/css/style.css",
    "/pages/admin/admin.html",
    "/pages/field-notes-secret/posts.json",
    "",
  ]) {
    assert.equal(resolveFile(path), null, `should refuse ${path}`);
  }
});

test("resolveFile: refuses traversal, encoded or not", () => {
  for (const path of [
    "/pages/field-notes/posts/../../../netlify/functions/publish.mjs",
    "/pages/field-notes/posts/..%2f..%2f.env",
    "/pages/field-notes/sources/../posts.json",
    "/pages/field-notes/../../.git/config",
    "/pages/field-notes/posts/a/b.html",
  ]) {
    assert.equal(resolveFile(path), null, `should refuse ${path}`);
  }
});

// field-notes.css is hand-owned and still served statically from the
// build; the function must not shadow it.
test("resolveFile: refuses field-notes.css", () => {
  assert.equal(resolveFile("/pages/field-notes/field-notes.css"), null);
});

test("resolveFile: refuses a slug that isn't slugify-shaped", () => {
  for (const slug of [
    "Hello",
    "hello_world",
    "hello.world",
    "-hello",
    "hello-",
    "hello--world",
    "héllo",
    "",
  ]) {
    assert.equal(
      resolveFile(`/pages/field-notes/posts/${slug}.html`),
      null,
      `should refuse slug "${slug}"`,
    );
  }
});

test("resolveFile: refuses the right slug with the wrong extension", () => {
  assert.equal(resolveFile("/pages/field-notes/posts/hello.txt"), null);
  assert.equal(resolveFile("/pages/field-notes/sources/hello.html"), null);
});

/* ------------------------------------------- how it finds the request */

const headers = (map) => ({ get: (k) => map[k.toLowerCase()] ?? null });

test("requestedPath: prefers the explicit ?file= from the redirect", () => {
  assert.equal(
    requestedPath(
      "https://x/.netlify/functions/notes?file=pages/field-notes/feed.xml",
      headers({ "x-nf-original-path": "/somewhere/else" }),
    ),
    "pages/field-notes/feed.xml",
  );
});

test("requestedPath: falls back to Netlify's original-path header", () => {
  assert.equal(
    requestedPath(
      "https://x/.netlify/functions/notes",
      headers({ "x-nf-original-path": "/pages/field-notes/posts.json?v=2" }),
    ),
    "/pages/field-notes/posts.json",
  );
});

test("requestedPath: falls back to the request's own path", () => {
  assert.equal(
    requestedPath("https://x/pages/field-notes/field-notes.html", headers({})),
    "/pages/field-notes/field-notes.html",
  );
});

test("requestedPath: survives absent headers entirely", () => {
  assert.equal(
    requestedPath("https://x/pages/field-notes/feed.xml", undefined),
    "/pages/field-notes/feed.xml",
  );
});
