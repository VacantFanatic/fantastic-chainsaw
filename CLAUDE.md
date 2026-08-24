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

A piece can still split its script across multiple files for
navigability (see `pages/character-generator/`) as long as they're
loaded as plain `<script src>` tags, in dependency order, with no
`type="module"` — module scripts refuse to load over `file://`, which
would break "open `index.html` directly." Classic scripts share one
global scope across tags (`const`/`let` included, not just functions),
so this is organization, not architecture.

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
NOTES.md            running review notes: known issues, open items
.prettierrc.json    formatting; the whole tree complies
.gitattributes      forces LF checkouts so prettier agrees with CI
.github/workflows/  CI: format, local links, no-build-step guard
```

## Conventions

- Format before committing:
  `npx prettier@3.9.6 --write "**/*.{html,css,js,json,md}"`. CI checks the
  same glob at the same pinned version, so this is always enough to make it
  pass. The tree is currently fully compliant — keep it that way.
- Colors go through tokens in `:root`. No hardcoded hex in rules.
- Canvas work is HiDPI-correct: size the backing store in device pixels,
  and remember `putImageData` ignores the transform matrix (this was a
  real bug once — see `js/main.js`).
- New pieces get an `<li class="entry">` in the index; drop
  `entry--placeholder` once it's real.
- Keep `NOTES.md` honest — mark things fixed when they're fixed.

## Still open

Not yet wired up: hosting/deploy and a custom domain. `main` also has no
server-side protection — the repo is private on a free plan, so GitHub
refuses branch protection and rulesets. Branch-per-change is a convention
here, not something the remote enforces. See the "Repo hygiene" section of
`NOTES.md`.
