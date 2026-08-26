// Netlify's `ignore` command, wired up in netlify.toml. Netlify runs this
// before every build and reads the exit code backwards from what you'd
// guess: exit 0 means "nothing to do, cancel the build", anything non-zero
// means "go ahead and build". A cancelled build is the cheap outcome.
//
// It exists because builds are the scarce resource on this site, and most
// commits don't change anything a visitor can see. A README fix, a new
// test, a CI tweak -- all of those used to ship a full production deploy
// for a site that is byte-for-byte identical afterwards. (See c5e604e: a
// one-file README commit that deployed.)
//
// Two things get skipped:
//
//   1. Anything that isn't a production deploy. Deploy previews and branch
//      deploys are builds too, and branch-per-change plus PRs means they
//      easily outnumber real publishes. Turn them off in the Netlify UI as
//      well (Site configuration -> Build & deploy -> Branches and deploy
//      contexts); this is the belt to that pair of braces, and works even
//      if the dashboard setting gets flipped back.
//   2. Production commits that touch nothing the deployed site serves --
//      docs, tests, CI config, formatter config, .claude/.
//
// Fails safe in every direction: any uncertainty at all (no cached commit,
// a shallow clone that doesn't contain it, git erroring out, an unreadable
// env) deploys rather than skips. A wasted build is a nuisance; silently
// not shipping a post is a bug you would find out about much later.
//
// Zero dependencies, like everything else here -- node:child_process only.

import { execFileSync } from "node:child_process";

// Two kinds of file don't need a build. Anything NOT matched here is
// assumed to be site-affecting, which is the safe way round: a new
// top-level thing deploys by default instead of being silently ignored.
const IGNORED = [
  // 1. Things that exist for people working on the repo, not for people
  //    reading the site.
  /^[^/]+\.md$/, // README.md, NOTES.md, CLAUDE.md
  /^tests\//,
  /^\.github\//,
  /^\.claude\//,
  /^\.vscode\//,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.prettierrc\.json$/,
  /^\.prettierignore$/,

  // 2. Field note content, which netlify/functions/notes.mjs serves from
  //    git per request rather than from the build. A publish, an edit and
  //    an unpublish touch only these paths, so none of them costs a
  //    deploy -- that's the whole point of the serving function.
  //
  //    field-notes.css is deliberately absent: it's hand-owned and still
  //    served statically from the build, so changing it must deploy.
  /^pages\/field-notes\/field-notes\.html$/,
  /^pages\/field-notes\/posts\.json$/,
  /^pages\/field-notes\/feed\.xml$/,
  /^pages\/field-notes\/posts\//,
  /^pages\/field-notes\/sources\//,
];

function build(reason) {
  console.log(`deploying: ${reason}`);
  process.exit(1); // non-zero -> Netlify runs the build
}

function skip(reason) {
  console.log(`skipping build: ${reason}`);
  process.exit(0); // zero -> Netlify cancels the build
}

function git(...args) {
  // stderr piped rather than inherited: a missing cached commit is an
  // expected, handled case, and a bare `fatal:` in the deploy log reads
  // like something broke when nothing did.
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

const context = process.env.CONTEXT ?? "";
const cached = process.env.CACHED_COMMIT_REF ?? "";
const head = process.env.COMMIT_REF ?? "HEAD";

if (context && context !== "production") {
  skip(`${context} is not the production context`);
}

if (!cached) {
  build("no CACHED_COMMIT_REF -- treating this as a first deploy");
}

// Netlify clones shallowly, so the last deployed commit is often simply
// not present in this checkout. Without it there's nothing to diff, and
// guessing is not on the table.
try {
  git("cat-file", "-e", `${cached}^{commit}`);
} catch {
  build(`${cached.slice(0, 8)} is not in this clone -- can't diff safely`);
}

let changed;
try {
  changed = git("diff", "--name-only", cached, head)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
} catch (err) {
  build(`git diff failed (${err.message.split("\n")[0]})`);
}

if (changed.length === 0) {
  skip("no files changed since the last deploy");
}

const relevant = changed.filter(
  (file) => !IGNORED.some((pattern) => pattern.test(file)),
);

if (relevant.length === 0) {
  skip(
    `${changed.length} file(s) changed, none of them served: ${changed.join(", ")}`,
  );
}

build(`${relevant.length} site file(s) changed: ${relevant.join(", ")}`);
