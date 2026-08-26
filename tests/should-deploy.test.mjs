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
  // Astro source is the site now. Field notes used to appear here as
  // generated files needing an exemption; they live in Supabase, so
  // publishing never produces a commit at all.
  commit("app-source", {
    "src/pages/field-notes/index.astro": "---\n---\n<p>hi</p>",
    "src/lib/notes.js": "export const x = 1;\n",
  });
  commit("a-function", { "src/pages/api/notes.js": "export {};\n" });
  commit("netlify-config", {
    "netlify.toml": '[build]\n  publish = "dist"\n',
  });
  commit("a-new-page", {
    "public/pages/starfield/starfield.html": "<canvas></canvas>",
  });
  commit("mixed", {
    "public/css/style.css": ":root { --ink: #000; }\n",
    "README.md": "# readme, once more\n",
    "tests/x.test.mjs": "// again\n",
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

// Astro source is the site now, so a change here must deploy.
test("an app source change deploys", () => {
  const { code } = guard({
    cached: commits["tests-and-ci-only"],
    head: commits["app-source"],
  });
  assert.equal(code, DEPLOY);
});

test("an unchanged tree does not spend a build", () => {
  const { code } = guard({
    cached: commits["app-source"],
    head: commits["app-source"],
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
    cached: commits["app-source"],
    head: commits["a-new-page"],
  });
  assert.equal(code, DEPLOY);
});

test("a function change deploys", () => {
  const { code } = guard({
    cached: commits["app-source"],
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
  const { code, output } = guard({ cached: "", head: commits["app-source"] });
  assert.equal(code, DEPLOY);
  assert.match(output, /first deploy/);
});

test("a cached commit missing from a shallow clone deploys", () => {
  const { code, output } = guard({
    cached: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    head: commits["app-source"],
  });
  assert.equal(code, DEPLOY);
  assert.match(output, /can't diff safely/);
});

test("an unreadable HEAD deploys", () => {
  const { code } = guard({ cached: commits.base, head: "not-a-real-ref" });
  assert.equal(code, DEPLOY);
});
