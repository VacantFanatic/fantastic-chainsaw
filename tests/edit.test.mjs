// Unit tests for edit.mjs's pure helper. Same shape and same reasons as
// publish.test.mjs: no network, no npm dependency, and it lives outside
// netlify/functions/ so Netlify's bundler doesn't try to deploy it as a
// function. Run with `node --test "tests/*.test.mjs"`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdit } from "../netlify/functions/edit.mjs";

const posts = [
  { slug: "c", title: "Third", date: "2026-08-26T00:00:00.000Z", excerpt: "c" },
  { slug: "b", title: "Second", date: "2026-08-25T00:00:00.000Z", excerpt: "b" },
  { slug: "a", title: "First", date: "2026-08-24T00:00:00.000Z", excerpt: "a" },
];

const revision = { title: "Second, revised", excerpt: "new excerpt" };

test("applyEdit: rewrites title and excerpt for the matching slug", () => {
  const { updated } = applyEdit(posts, "b", revision);
  assert.equal(updated.title, "Second, revised");
  assert.equal(updated.excerpt, "new excerpt");
});

// The whole point of an edit being an edit: a published URL keeps working
// and a three-year-old note doesn't jump to the top of the listing.
test("applyEdit: never touches the slug or the original date", () => {
  const { updated } = applyEdit(posts, "b", revision);
  assert.equal(updated.slug, "b");
  assert.equal(updated.date, "2026-08-25T00:00:00.000Z");
});

test("applyEdit: leaves manifest order alone", () => {
  const { posts: next } = applyEdit(posts, "a", revision);
  assert.deepEqual(
    next.map((p) => p.slug),
    ["c", "b", "a"],
  );
});

test("applyEdit: leaves every other entry untouched", () => {
  const { posts: next } = applyEdit(posts, "b", revision);
  assert.deepEqual(next[0], posts[0]);
  assert.deepEqual(next[2], posts[2]);
});

test("applyEdit: unknown slug changes nothing and reports null", () => {
  const { updated, posts: next } = applyEdit(posts, "nope", revision);
  assert.equal(updated, null);
  assert.equal(next, posts);
});

test("applyEdit: does not mutate the manifest it was given", () => {
  applyEdit(posts, "b", revision);
  assert.equal(posts[1].title, "Second");
  assert.equal(posts[1].excerpt, "b");
});

test("applyEdit: an empty manifest is a miss, not a crash", () => {
  const { updated, posts: next } = applyEdit([], "b", revision);
  assert.equal(updated, null);
  assert.deepEqual(next, []);
});
