// Unit tests for unpublish.mjs's pure helper. Same shape and same reasons
// as publish.test.mjs: no network, no npm dependency, and it lives outside
// netlify/functions/ so Netlify's bundler doesn't try to deploy it as a
// function. Run with `node --test tests/`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { removePost } from "../netlify/functions/unpublish.mjs";

const posts = [
  { slug: "c", title: "Third", date: "2026-08-26T00:00:00.000Z" },
  { slug: "b", title: "Second", date: "2026-08-25T00:00:00.000Z" },
  { slug: "a", title: "First", date: "2026-08-24T00:00:00.000Z" },
];

test("removePost: drops the matching post and reports it", () => {
  const { removed, remaining } = removePost(posts, "b");
  assert.equal(removed.title, "Second");
  assert.deepEqual(
    remaining.map((p) => p.slug),
    ["c", "a"],
  );
});

test("removePost: unknown slug removes nothing and reports null", () => {
  const { removed, remaining } = removePost(posts, "nope");
  assert.equal(removed, null);
  assert.deepEqual(
    remaining.map((p) => p.slug),
    ["c", "b", "a"],
  );
});

test("removePost: leaves the input manifest untouched", () => {
  removePost(posts, "c");
  assert.equal(posts.length, 3);
});

test("removePost: removing the only post leaves an empty manifest", () => {
  const { removed, remaining } = removePost([posts[0]], "c");
  assert.equal(removed.slug, "c");
  assert.deepEqual(remaining, []);
});

// The near-duplicate slugs uniqueSlug() generates (`foo`, `foo-2`) are the
// exact case this feature exists for -- removing one must not take the
// other with it.
test("removePost: a `-2` suffixed slug is distinct from its base", () => {
  const dupes = [{ slug: "mt-joy-2" }, { slug: "mt-joy" }];
  assert.deepEqual(
    removePost(dupes, "mt-joy-2").remaining.map((p) => p.slug),
    ["mt-joy"],
  );
  assert.deepEqual(
    removePost(dupes, "mt-joy").remaining.map((p) => p.slug),
    ["mt-joy-2"],
  );
});
