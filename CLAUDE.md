# STATIC

## What this is

A personal website that is **part blog, part art project** — independent,
low-fi, and bespoke, with the feel of the MySpace-era personal homepage.
Not a portfolio, not a product, not a content platform.

The reference point is the web before feeds: a page someone clearly made
by hand, that looks like nobody else's, where the layout itself is part
of the self-expression. Idiosyncratic over polished. Made over generated.

Concretely that means:

- **A directory, not a feed.** The home page is an index of things,
  ordered by hand. No infinite scroll, no recommendations, no "you might
  also like", no engagement metrics anywhere.
- **Writing and art side by side.** Long-form posts and interactive
  pieces are peers in the same index, not separate sections. A page can
  be either or both.
- **Every page is allowed to be its own thing.** Shared tokens exist so
  the site feels like one place, but a piece is free to override them
  entirely (see `pages/starfield/starfield.html`). Consistency serves the work; it
  doesn't outrank it.
- **Visible seams are fine.** Monospace labels, `index of /`, dashed
  rules, "broadcasting since 2026", CRT phosphor mode. The construction
  showing is the aesthetic.

## Hard constraints

These are the point of the project, not temporary limitations:

- **No framework.** No React, no Svelte, no static site generator.
- **No build step.** Cloning the repo and opening `index.html` works.
- **No runtime dependencies.** Nothing that needs `npm install` to view
  the site. Prettier is dev-only tooling and stays that way.
- **Hand-written HTML, CSS, and vanilla JS.**

If something seems to need a build step, the answer is almost always to
want less, not to add a toolchain.

All four still hold literally, including after field notes moved to
request-time serving (see "Publishing does not require a deploy" below):
every page in the repo is still real, final HTML, and a clone still opens
in a browser with no tooling. What that change did add is a **delivery**
dependency — on the deployed site, a field note reaches a reader through
a function and the GitHub API rather than straight off the CDN. The files
are unchanged and still served correctly by any plain static host, so
this is an acceleration layered on top, not a replacement. Don't let it
become the excuse for a second one.

A piece can still split its script across multiple files for
navigability (see `pages/character-generator/`) as long as they're
loaded as plain `<script src>` tags, in dependency order, with no
`type="module"` — module scripts refuse to load over `file://`, which
would break "open `index.html` directly." Classic scripts share one
global scope across tags (`const`/`let` included, not just functions),
so this is organization, not architecture.

## One narrow exception: managing field notes

`netlify/functions/` is the one backend on this otherwise fully static
site, and the one place two of the rules above don't apply. Three
endpoints, all secret-gated, all driven from `pages/admin/admin.html`:

- `publish.mjs` (`/api/publish`) — new note from a title + plain text.
- `edit.mjs` (`/api/edit`) — revise a published note's title and body.
  The slug and the original date never change: a published URL is a
  promise, and an edit is not a republish.
- `unpublish.mjs` (`/api/unpublish`) — take a note back down.

`publish.mjs` owns the renderers and the GitHub plumbing; the other two
import from it, so all three produce byte-identical listing and feed
markup and can't drift apart. The two rules they bend:

- They commit directly to `main`, bypassing the branch-per-change
  convention on purpose — everywhere else, still branch and PR.
- `pages/field-notes/field-notes.html` and every `pages/field-notes/posts/
*.html` are exempted from the Prettier check in `.prettierignore`,
  because they're regenerated on every publish and Prettier's HTML
  printer is too whitespace-sensitive to hand-match reliably inside a
  template string.

Every other rule still holds: zero npm dependencies (only built-in
Node/Fetch APIs, no `package.json` anywhere), so "no runtime dependencies"
holds for the backend too, and "no build step" still holds for the reading
experience — every page in the repo is real, final HTML; the functions
just do by API what a human would otherwise do by hand.

**One commit per action, always.** Writes go through the Git Data API
(blob → tree → commit → ref), not the Contents API, because the Contents
API can only write one file per commit — which meant one publish produced
four commits and four Netlify builds. Assembling the tree by hand is a few
more requests for exactly one commit, one build, and an operation that's
atomic: either the whole note lands or none of it does. Anything added
here that touches several files must go in the same `ghCommit` call rather
than a second one.

They own five generated things, all of which should be treated as build
output and never hand-edited: `pages/field-notes/posts.json`,
`pages/field-notes/field-notes.html`, `pages/field-notes/feed.xml`, every
`pages/field-notes/posts/<slug>.html`, and every
`pages/field-notes/sources/<slug>.txt`. A manual edit to any of these will
be silently overwritten by the next publish or edit.

`sources/` is what makes editing possible: the rendered page is HTML, but
the thing a human wrote is plain text, and reversing prose back out of
generated markup is not something to attempt. Each note's source is saved
verbatim next to it — one file per note rather than one shared JSON blob,
so prose stays unescaped and a diff shows the paragraph that actually
changed. Notes published before this existed have no source file; the
admin form says so instead of offering an empty box that would blank the
post on save.

The one file in that folder that's safe to hand-edit is
`pages/field-notes/field-notes.css` — styling isn't touched by any of the
functions. All three actions happen through `pages/admin/admin.html`, a
small form gated by a shared secret and deliberately not linked from
anywhere public.

## Publishing does not require a deploy

**This is the rule the whole field notes design now serves. Writing,
editing or removing a note must never need a Netlify build.** Build
capacity is a hard, exhaustible budget — run out and the site cannot be
deployed at all until it resets, which is exactly the situation this was
built in response to. A blog that can't publish because the host is out
of build minutes is broken.

So field notes are served **from git at request time**, by
`netlify/functions/notes.mjs`. `publish.mjs` commits real HTML to `main`
exactly as it always did; the function fetches that committed file when a
reader asks for it, so a note is live within seconds of the commit and no
build happens. `netlify.toml` routes the five dynamic paths to it with
`force = true` — without force, Netlify serves the copy baked into the
last build, which is the stale file this exists to route around.

What this means when changing things here:

- **A deploy is for pages and functionality**, not for content. If you
  find yourself needing one to make a note appear, something has broken.
- **`pages/field-notes/field-notes.css` is the exception** — hand-owned,
  still served statically from the build, and therefore the one file in
  that folder that _does_ cost a deploy to change. It's deliberately
  absent from both the redirect list and the build-guard ignore list.
- **`resolveFile` in `notes.mjs` is a security boundary.** That function
  holds a token that can read the entire private repo, so it serves a
  strict allowlist and rebuilds the repo path from validated pieces
  rather than passing request input through. Adding a servable path means
  adding an explicit case, never loosening the pattern.
- **The static files stay.** They're what makes this reversible: delete
  the function and the redirects and the site falls back to build-time
  serving with no migration. They also keep `git clone` and CI's link
  checker honest.

## Builds are the scarce resource

Netlify build capacity is the real budget on this site, so a commit that
changes nothing a visitor can see should not spend one. Two rules follow:

- **Every action is one commit.** Publish, edit and unpublish each touch
  four or five files and each must land in a single `ghCommit` call, never
  a sequence of writes. This is also why the functions use the Git Data
  API — see "One narrow exception" above.
- **`netlify/should-deploy.mjs` decides whether a build happens at all.**
  It's wired in as `netlify.toml`'s `ignore` command, and it cancels the
  build for anything that isn't a production deploy (deploy previews and
  branch deploys are builds too), for production commits that only touch
  docs, tests, CI, formatter config, or `.claude/`, and for field note
  content, which `notes.mjs` serves from git rather than from the build.
  A publish, an edit and an unpublish therefore cost zero builds.

Two things to keep true when changing that script. Netlify reads its exit
code **backwards** — `0` cancels the build, non-zero proceeds. And it must
**fail safe**: any uncertainty (no cached commit, a shallow clone, git
erroring) has to deploy, because a wasted build is a nuisance while
silently not shipping a post is a bug you'd discover days later. The
ignore list is a denylist for exactly that reason — a new top-level path
deploys by default instead of being silently dropped. Its behavior is
pinned by `tests/should-deploy.test.mjs`, which runs the real script
against a throwaway git repo.

Deploy previews and branch deploys should also be turned off in the
Netlify UI (Site configuration → Build & deploy → Branches and deploy
contexts). The script is the backstop, not the only line of defense.

## Low-fi is a style, not an excuse

The aesthetic is deliberately rough. The _implementation_ is not. Two
things are non-negotiable regardless of how lo-fi the surface looks:

- **Text meets WCAG AA (4.5:1).** Enforced by splitting tokens where
  needed: `--phosphor-dim` is for text and must clear 4.5:1 on
  `--phosphor-bg`; `--phosphor-line` is for borders and is free to stay
  faint. Don't reuse a text color for a border or vice versa — split the
  token instead.
- **Motion respects `prefers-reduced-motion`.** Every animated piece
  needs a still-frame fallback that still reads as intentional.

Keyboard focus is always visible (`:focus-visible`), decorative canvases
are `aria-hidden`, and anything that isn't a real destination isn't an
`<a href>`.

## Layout

```
index.html          home page — the hand-ordered index of everything
css/style.css       shared tokens + layout (paper/ink default, phosphor mode)
js/main.js          home page behavior (static strip, phosphor toggle)
pages/              one subfolder per piece (html/css/js together); a
                    single-file piece can skip the subfolder
pages/field-notes/  the blog: generated listing/posts/feed/sources +
                    hand-owned CSS
pages/admin/        unlinked publish/edit/unpublish forms, post to
                    netlify/functions/
netlify.toml        Netlify config: publish dir, functions dir, the
                    build-skip guard, the field-notes rewrites, headers
netlify/functions/  the one backend piece — see "One narrow exception" above
netlify/functions/notes.mjs
                    serves field notes from git per request — see
                    "Publishing does not require a deploy" above
netlify/should-deploy.mjs
                    netlify.toml's `ignore` command — cancels builds that
                    change nothing served; see "Builds are the scarce
                    resource" above
NOTES.md            running review notes: known issues, open items
.prettierrc.json    formatting; the whole tree complies (see .prettierignore)
.gitattributes      forces LF checkouts so prettier agrees with CI
.github/workflows/  CI: format, local links, no-build-step guard
```

## Conventions

- Format before committing:
  `npx prettier@3.9.6 --write "**/*.{html,css,js,json,md}"`. CI checks the
  same glob at the same pinned version, so this is always enough to make it
  pass. The tree is currently fully compliant — keep it that way. The two
  paths in `.prettierignore` are the sole exception, and why is documented
  there and in "One narrow exception" above.
- Colors go through tokens in `:root`. No hardcoded hex in rules.
- Canvas work is HiDPI-correct: size the backing store in device pixels,
  and remember `putImageData` ignores the transform matrix (this was a
  real bug once — see `js/main.js`).
- New pieces get an `<li class="entry">` in the index; drop
  `entry--placeholder` once it's real.
- Keep `NOTES.md` honest — mark things fixed when they're fixed.

## Still open

Hosting now has a concrete answer — Netlify, chosen because it's the one
of the two documented deploy options (see `README.md`) that can run
`netlify/functions/publish.mjs` — but it's not yet _connected_: the repo
still needs to be linked to a Netlify site and its env vars set before
field notes can actually be published. GitHub Pages remains a valid choice
if the publish flow doesn't matter to you, since it can still serve every
static page. A custom domain is separately still unwired.

`main` also has no server-side protection — the repo is private on a free
plan, so GitHub refuses branch protection and rulesets. Branch-per-change
is a convention here, not something the remote enforces, and the field
notes publish function is a deliberate, narrow exception to it (see
above). See the "Repo hygiene" section of `NOTES.md`.
