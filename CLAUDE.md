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
  entirely (see `public/pages/starfield/starfield.html`). Consistency
  serves the work; it doesn't outrank it.
- **Visible seams are fine.** Monospace labels, `index of /`, dashed
  rules, "broadcasting since 2026", CRT phosphor mode. The construction
  showing is the aesthetic.

## Constraints, and what changed

This was, for most of its life, a site with no framework, no build step and
no dependencies — every page a real HTML file you could open off disk. That
is no longer true of the whole site, and the reason is worth recording so
nobody reverses it by accident.

Field notes used to be published by committing generated HTML to this repo.
That made publishing a deploy, and Netlify build capacity is a hard,
exhaustible budget: run out mid-month and the blog cannot publish at all
until it resets. Two attempts to keep the static model and route around
that failed — the second shipped a listing that 404'd in production. The
rule that survived is the one that mattered:

> **Publishing must never require a deploy.**

So field notes now live in Supabase and are rendered on request by Astro.
Deploys are for pages and functionality; content never touches git.

What still holds, and is still the point:

- **Hand-written HTML, CSS and vanilla JS.** No UI framework, no component
  library, no CSS framework, no client-side router. Astro is a renderer and
  a router; it is not a licence to reach for React.
- **The pages are still pages.** `public/` holds the hand-written site —
  `index.html`, the starfield, the character generator — copied to `dist/`
  byte for byte, still openable from disk, still with no runtime JS beyond
  what each piece brings itself.
- **A reader downloads no framework.** Astro ships zero client JavaScript
  by default and nothing here opts in. The only inline scripts on the whole
  site are the two on `/admin`, which a reader never sees.

What no longer holds, honestly:

- **There is a build step**, a `package.json`, and `node_modules`.
  `npm ci && npm run build` is now required to produce the site.
- **Field notes are not files.** They are rows. A clone of this repo
  contains the site but not the writing.
- **There are dependencies, and they carry advisories.**
  `@astrojs/netlify` pulls in Netlify's local-dev tooling (sharp, ipx,
  extract-zip), which reports high-severity issues that don't resolve
  without breaking changes. They are dev-time, not in the deployed
  function. This is the real cost of the framework — re-check it, don't
  forget it.

If something seems to need a _second_ framework, the answer is still to
want less.

## How field notes work

Three moving parts, and the boundaries between them matter more than any
one of them.

**Supabase holds the content and the identity.** `supabase/schema.sql` is
the whole data model: a `notes` table, an `admins` table, and row-level
security policies. `supabase/seed.sql` carries the three notes that predate
the move, with their original slugs, dates and preview cards.

**Row-level security is the security boundary — not the application.** Read
that again before changing anything here:

- There is **no service-role key** anywhere in this codebase, and adding
  one would undo the entire design. Reads use the anon key, which RLS
  limits to published notes. Writes run as the signed-in admin's own
  session.
- Being signed in is **not** authorisation. Write policies require
  membership of `admins`, so a valid Supabase user who isn't an admin can
  do exactly what the public can do. `tests/integration.mjs` proves this
  with a real non-admin account; keep that test.
- `currentAdmin()` in `src/lib/supabase.js` returns 401 early as a
  courtesy. It is not what stops an attacker. The database is.
- Session cookies are `httpOnly` and `sameSite=lax` — the first stops page
  scripts reading the session, the second is what stands in for CSRF tokens
  on the JSON endpoints.

**Astro renders.** `src/pages/field-notes/` is server-rendered
(`export const prerender = false`) so a note is live the moment it's saved.
`src/lib/render.mjs` is the plain-text-to-HTML renderer carried over
unchanged from the static era, still pure and still unit-tested — the one
piece of the old implementation worth keeping.

Two rules that are easy to break silently:

- **An edit is not a republish.** `updateNote` never puts `slug` or
  `published_at` in the update payload, so a URL keeps working and an old
  note doesn't jump to the top of the listing.
- **Unpublishing is a status change, not a delete.** It sets
  `status = 'draft'`. The old version deleted files and called git history
  the undo; this is reversible from the UI.

Link previews are fetched **once, when a note is saved**, and stored on the
row. A reader's pageview must never trigger an outbound request to someone
else's server.

## Legacy URLs are promises

The old site published `/pages/field-notes/field-notes.html` and
`/pages/field-notes/posts/<slug>.html`. Both permanently redirect to
`/field-notes` and `/field-notes/<slug>`, via routes under
`src/pages/pages/`. That directory looks like a mistake and isn't — delete
it and every link ever shared breaks. The redirects are covered by
`tests/integration.mjs`.

## Testing, and why there's so much of it

The previous attempt at this feature passed 73 unit tests and was broken in
production, because nothing had ever served a page. So:

- `tests/render.test.mjs` — the pure renderer. Fast, no I/O.
- `tests/should-deploy.test.mjs` — runs the real build guard against a
  throwaway git repo.
- `tests/fake-supabase.mjs` + `tests/integration.mjs` — the real Astro
  server, real cookie handling, real rendering, against a fake Supabase
  that enforces the RLS rules the app depends on. It signs in, publishes,
  reads the HTML back, and checks that a signed-out caller is refused and
  that an unpublished note actually disappears.

The integration test needs a dev server (`npm run dev` in one terminal,
`node tests/integration.mjs` in another). CI runs both, plus the build, and
asserts the SSR function was actually emitted. **A green CI that never
rendered a page is what got us here** — don't remove those steps.

## Builds are still worth not wasting

`netlify/should-deploy.mjs` is `netlify.toml`'s `ignore` command. It
cancels the build for anything that isn't a production deploy (deploy
previews and branch deploys are builds too) and for commits touching only
docs, tests, CI or formatter config. Netlify reads its exit code
**backwards**: `0` cancels, non-zero proceeds. It must **fail safe** — any
uncertainty deploys, because a wasted build is a nuisance and a silently
unshipped change is a bug found days later.

Field notes are no longer in its ignore list, because they are no longer in
the repo at all.

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
public/             the hand-written site, copied to dist/ untouched
  index.html        home page — the hand-ordered index of everything
  css/style.css     shared tokens + layout (paper/ink, phosphor mode)
  js/main.js        home page behavior (static strip, phosphor toggle)
  pages/            starfield, character-generator, wire — URLs unchanged
src/
  lib/render.mjs    plain text -> HTML; pure, unit-tested, pre-dates Astro
  lib/feed.mjs      RSS/Atom parsing for "the wire"; pure except fetchFeed
  lib/supabase.js   request-scoped clients + currentAdmin(); no service key
  lib/notes.js      all reads and writes for notes, in one place
  layouts/Base.astro
  components/       the two admin scripts (conditional, so not inline)
  styles/           field-notes.css (hand-owned), admin.css
  pages/field-notes/  listing, [slug], feed.xml — all prerender:false
  pages/admin/      login + desk, gated server-side
  pages/api/        auth.js, notes.js, feed.js — JSON endpoints
  pages/pages/      legacy URL redirects; see "Legacy URLs are promises"
supabase/
  schema.sql        tables, RLS policies, is_admin(); run this first
  seed.sql          the three pre-Supabase notes
netlify.toml        build command, publish dir, build-skip guard, headers
netlify/should-deploy.mjs
                    netlify.toml's `ignore` command
tests/              see "Testing" above
NOTES.md            running review notes: known issues, open items
```

## Conventions

- Format before committing: `npm run format`. CI runs
  `npm run format:check` on the same glob. Prettier is pinned in
  `package.json`.
- Colors go through tokens in `:root`. No hardcoded hex in rules.
- Canvas work is HiDPI-correct: size the backing store in device pixels,
  and remember `putImageData` ignores the transform matrix (this was a
  real bug once — see `public/js/main.js`).
- New pieces get an `<li class="entry">` in `public/index.html`; drop
  `entry--placeholder` once it's real. A new static piece goes in
  `public/pages/` and needs no Astro route.
- Keep `NOTES.md` honest — mark things fixed when they're fixed.
- `public/pages/wire/` is the first use of `localStorage` anywhere in this
  codebase — starfield keeps its state in memory only, and the character
  generator deliberately uses URL-hash state instead. If a future piece
  wants client-side persistence, that's the precedent to follow.
- `src/lib/feed.mjs`'s RSS/Atom parsing is regex, not a real XML parser —
  the second precedent (after `render.mjs`'s `parseOgTags`) for hand-
  rolling markup extraction rather than adding an npm parsing dependency.

## Still open

`main` has no server-side protection — the repo is private on a free plan,
so GitHub refuses branch protection and rulesets. Branch-per-change is a
convention here, not something the remote enforces.

A custom domain is still unwired. The dependency advisories noted above are
unresolved. And the rest of the site — the home index, starfield, the
character generator — is deliberately still hand-written static HTML; the
decision on whether any of it should become Astro pages was postponed until
field notes were working.
