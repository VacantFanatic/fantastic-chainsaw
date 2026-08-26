// Tests for the Netlify build guard (netlify/should-deploy.mjs).
//
// Unlike the other test files these aren't unit tests of a pure helper --
// the whole risk in that script lives in the parts that read env vars and
// shell out to git, so it gets run for real, as a subprocess, against a
// throwaway repo built here. Nothing touches the real repo or the network.
//
// A throwaway repo rather than this one's history on purpose: CI checks
// out shallow, so any test pinned to real commits would pass locally and
// fail there.
//
// Remember the inverted convention: exit 0 means Netlify CANCELS the
// build, non-zero means it proceeds.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(
  new URL("../netlify/should-deploy.mjs", import.meta.url),
);

const SKIP = 0;
const DEPLOY = 1;

let repo;
const commits = {};

function git(...args) {
  return execFileSync("git", args, {
    cwd: repo,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commit(label, files) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  git("add", "-A");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-m", label);
  commits[label] = git("rev-parse", "HEAD");
}

// Runs the guard the way Netlify does and returns { code, output }.
function guard({ context = "production", cached, head }) {
  const result = spawnSync(process.execPath, [SCRIPT], {
    cwd: repo,
    encoding: "utf8",
    env: {
      ...process.env,
      CONTEXT: context,
      CACHED_COMMIT_REF: cached ?? "",
      COMMIT_REF: head ?? "",
    },
  });
  return { code: result.status, output: result.stdout.trim() };
}

before(() => {
  repo = mkdtempSync(join(tmpdir(), "should-deploy-"));
  git("init", "-b", "main");

  commit("base", {
    "index.html": "<h1>one</h1>",
    "README.md": "# readme\n",
    "tests/x.test.mjs": "// test\n",
    ".github/workflows/ci.yml": "name: CI\n",
    ".prettierrc.json": "{}\n",
  });
  commit("docs-only", { "README.md": "# readme, revised\n" });
  commit("tests-and-ci-only", {
    "tests/x.test.mjs": "// revised\n",
    ".github/workflows/ci.yml": "name: CI2\n",
    ".prettierrc.json": '{ "semi": true }\n',
  });
  // Exactly the file set one publish touches.
  commit("a-publish", {
    "pages/field-notes/posts/hello.html": "<p>hi</p>",
    "pages/field-notes/sources/hello.txt": "hi\n",
    "pages/field-notes/posts.json": "[]\n",
    "pages/field-notes/field-notes.html": "<ol></ol>",
    "pages/field-notes/feed.xml": "<rss/>",
  });
  commit("a-function", { "netlify/functions/publish.mjs": "export {};\n" });
  commit("netlify-config", { "netlify.toml": '[build]\n  publish = "."\n' });
  commit("field-notes-css", {
    "pages/field-notes/field-notes.css": ".note { color: red; }\n",
  });
  commit("a-new-page", {
    "pages/starfield/starfield.html": "<canvas></canvas>",
  });
  commit("mixed", {
    "css/style.css": ":root { --ink: #000; }\n",
    "README.md": "# readme, once more\n",
    "pages/field-notes/feed.xml": "<rss version='2.0'/>",
  });
});

after(() => rmSync(repo, { recursive: true, force: true }));

/* --------------------------------------------------- what gets skipped */

test("a docs-only commit does not spend a build", () => {
  const { code, output } = guard({
    cached: commits.base,
    head: commits["docs-only"],
  });
  assert.equal(code, SKIP);
  assert.match(output, /none of them served/);
});

test("tests, CI and formatter config do not spend a build", () => {
  const { code } = guard({
    cached: commits["docs-only"],
    head: commits["tests-and-ci-only"],
  });
  assert.equal(code, SKIP);
});

// The whole reason this project can publish while out of build credits:
// notes.mjs serves these files from git per request, so committing them
// must not cost a deploy. If this ever flips back to DEPLOY, publishing
// is billable again and the decoupling is broken.
test("a whole publish does not spend a build", () => {
  const { code, output } = guard({
    cached: commits["tests-and-ci-only"],
    head: commits["a-publish"],
  });
  assert.equal(code, SKIP);
  assert.match(output, /none of them served/);
});

test("an unchanged tree does not spend a build", () => {
  const { code } = guard({
    cached: commits["a-publish"],
    head: commits["a-publish"],
  });
  assert.equal(code, SKIP);
});

test("deploy previews and branch deploys do not spend a build", () => {
  for (const context of ["deploy-preview", "branch-deploy"]) {
    const { code, output } = guard({
      context,
      cached: commits.base,
      head: commits["a-new-page"], // real content, still skipped
    });
    assert.equal(code, SKIP, `${context} should skip`);
    assert.match(output, /not the production context/);
  }
});

/* -------------------------------------------------- what still deploys */

test("a new page deploys", () => {
  const { code } = guard({
    cached: commits["field-notes-css"],
    head: commits["a-new-page"],
  });
  assert.equal(code, DEPLOY);
});

test("a function change deploys", () => {
  const { code } = guard({
    cached: commits["a-publish"],
    head: commits["a-function"],
  });
  assert.equal(code, DEPLOY);
});

test("netlify.toml deploys -- it carries the routing and feed headers", () => {
  const { code } = guard({
    cached: commits["a-function"],
    head: commits["netlify-config"],
  });
  assert.equal(code, DEPLOY);
});

// field-notes.css is the one file in that folder still served from the
// build, so it's the one that must still deploy.
test("field-notes.css deploys -- the function does not serve it", () => {
  const { code, output } = guard({
    cached: commits["netlify-config"],
    head: commits["field-notes-css"],
  });
  assert.equal(code, DEPLOY);
  assert.match(output, /field-notes\.css/);
});

// One build-served file among ignored ones must still ship. Getting this
// backwards would silently stop deploying real changes.
test("a build-served file mixed with ignored ones still deploys", () => {
  const { code, output } = guard({
    cached: commits["a-new-page"],
    head: commits.mixed,
  });
  assert.equal(code, DEPLOY);
  assert.match(output, /style\.css/);
});

/* ------------------------------------------------------ failing safe */

test("no cached commit deploys rather than guessing", () => {
  const { code, output } = guard({ cached: "", head: commits["a-publish"] });
  assert.equal(code, DEPLOY);
  assert.match(output, /first deploy/);
});

test("a cached commit missing from a shallow clone deploys", () => {
  const { code, output } = guard({
    cached: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    head: commits["a-publish"],
  });
  assert.equal(code, DEPLOY);
  assert.match(output, /can't diff safely/);
});

test("an unreadable HEAD deploys", () => {
  const { code } = guard({ cached: commits.base, head: "not-a-real-ref" });
  assert.equal(code, DEPLOY);
});
