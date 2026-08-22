// Verify every local href/src in the site actually resolves to a file.
//
// The home page is a hand-ordered directory, so a renamed or deleted page in
// pages/ breaks a link with nothing to catch it -- there is no build step and
// no framework to complain. This is that check.
//
// Deliberately dependency-free: plain node, no install step. Remote URLs are
// not fetched (CI should not depend on the network or on someone else's
// uptime); only same-repo paths are resolved.

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");
const SKIP = new Set(["node_modules", ".git", ".github"]);

/** Every .html file in the repo, recursively. */
async function htmlFiles(dir = ROOT) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await htmlFiles(full)));
    else if (entry.name.endsWith(".html")) found.push(full);
  }
  return found;
}

// href="..." or src="..." -- single or double quoted.
const ATTR = /(?:href|src)\s*=\s*(["'])(.*?)\1/gi;

// Anything that does not point at a file in this repo.
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i;

const problems = [];
const files = await htmlFiles();

for (const file of files) {
  const html = await readFile(file, "utf8");
  const where = relative(ROOT, file).replaceAll("\\", "/");

  for (const [, , raw] of html.matchAll(ATTR)) {
    const value = raw.trim();
    if (!value || EXTERNAL.test(value)) continue;

    // Drop any fragment or query before resolving to a path on disk.
    const path = value.split(/[?#]/)[0];
    if (!path) continue;

    const target = path.startsWith("/")
      ? join(ROOT, path)
      : resolve(dirname(file), path);

    if (!existsSync(target)) problems.push(`${where}  ->  ${value}`);
  }
}

console.log(`checked ${files.length} html file(s)`);

if (problems.length) {
  console.error(`\n${problems.length} broken local link(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.log("all local links resolve");
