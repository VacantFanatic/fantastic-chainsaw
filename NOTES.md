# Repo Notes — review of `main`

Reviewed commit: `4b96f26` ("Initialize STATIC personal website")
Date: 2026-08-22

STATIC is a hand-written static site: no framework, no build step, no
dependencies. Seven files, ~800 lines total. Prettier is the only tooling.

This note records what I found reading through it. Nothing here is fixed —
it's a list, roughly in the order I'd tackle it.

## Verified bugs

> **Status:** items 1 and 2 are **fixed**; see the notes inline. Item 3 and
> everything below it is still open.

### 1. The static strip is blank on most screens (`js/main.js`) — FIXED

The signature masthead effect only draws on the top-left quarter of its
canvas on any HiDPI display — which is most laptops and every phone.

`resize()` sets the backing store to device pixels:

```js
canvas.width = width * window.devicePixelRatio;
```

but `draw()` builds an ImageData at _CSS_ pixel size and blits it at the
origin:

```js
const imageData = ctx.createImageData(width, height);
ctx.putImageData(imageData, 0, 0);
```

`putImageData` deliberately ignores the transform matrix (and globalAlpha,
and clipping) — the `ctx.setTransform(dpr, ...)` in `resize()` has no effect
on it. So a 1000x28 block of noise lands in a 2000x56 buffer.

Measured in headless Chromium at a 1000px viewport, sampling the alpha
channel at the four corners of the backing store:

| deviceScaleFactor | backing store | top-left | top-right | bottom-left | bottom-right |
| ----------------- | ------------- | -------- | --------- | ----------- | ------------ |
| 1                 | 1000x28       | 10       | 89        | 117         | 94           |
| 2                 | 2000x56       | 5        | **0**     | **0**       | **0**        |

At DPR 1 the noise covers the strip. At DPR 2, three quarters of it is
transparent.

**Fixed.** The noise is now generated at CSS-pixel size into an offscreen
buffer and scaled onto the device-pixel canvas with `drawImage` (which does
respect the transform), rather than blitted with `putImageData` (which does
not). Going through `drawImage` with `imageSmoothingEnabled = false` also
keeps the grain the same apparent size on every display, instead of turning
fine and smooth on retina screens.

Re-measured after the fix — noise coverage across a grid sweep of the whole
backing store:

| deviceScaleFactor | backing store | coverage |
| ----------------- | ------------- | -------- |
| 1                 | 1000x28       | 100%     |
| 1.5               | 1500x42       | 99%      |
| 2                 | 2000x56       | 100%     |
| 3                 | 3000x84       | 100%     |

The 99% at DPR 1.5 is one sampled pixel that randomed to zero alpha —
`alpha = 255 * shade * 0.5` rounds to 0 for roughly 0.8% of pixels, so about
1 in 119 samples is expected. It's the noise, not a gap.

### 2. Phosphor-mode body text fails WCAG AA badly (`css/style.css`) — FIXED

`--phosphor-dim` (`#2f5b3d`) on `--phosphor-bg` (`#0b0f0a`) is **2.47:1**.
AA needs 4.5:1 for normal text, 3:1 for large. It fails both.

That token isn't decorative — it's the color of most of the prose:
`.site-head__sub`, `.entry__note`, `.directory__label`, `.site-foot`, and on
the starfield page `.piece-title` and `.piece-hint`. Since starfield.html is
hardcoded to the phosphor palette, that page is _always_ in the failing
state.

Full palette audit (WCAG 2.x, normal text):

| pair                                    |    ratio | AA normal | AA large |
| --------------------------------------- | -------: | --------- | -------- |
| `--ink` on `--paper`                    |    12.26 | pass      | pass     |
| `--ink-soft` on `--paper`               |     5.28 | pass      | pass     |
| `--rust` on `--paper`                   |     4.47 | **fail**  | pass     |
| `--mint` on `--paper` (hover underline) |     2.59 | fail      | fail     |
| `--line` on `--paper` (borders)         |     1.60 | fail      | fail     |
| `--phosphor-fg` on `--phosphor-bg`      |    11.56 | pass      | pass     |
| `--phosphor-dim` on `--phosphor-bg`     | **2.47** | **fail**  | **fail** |

`--mint` and `--line` are decorative, so they matter less — though mint is
the _only_ hover affordance on entry links (`.entry__link:hover
.entry__name` sets `border-bottom-color`), so at 2.59:1 the hover state is
nearly invisible. `--rust` at 4.47 misses by a hair and is used at 0.75rem
in `.site-foot a` and `.site-head__tag`; nudging it darker clears it.

**Fixed**, but not by bumping the token in place. `--phosphor-dim` was doing
two jobs: 8 text declarations _and_ 4 border declarations. Raising it far
enough for text would have made the quiet dashed rules roughly twice as
prominent, which is the wrong trade for this design.

So the token is split:

- `--phosphor-dim: #4f9668` — **text only**, now **5.42:1** (passes AA, and
  still clearly dimmer than `--phosphor-fg` at 11.56:1).
- `--phosphor-line: #2f5b3d` — **borders only**, unchanged at 2.47:1, which
  is fine for a decorative rule.

`--rust` at 4.47:1 is **still open** — it misses AA for normal text by a
hair and is used at 0.75rem in `.site-foot a` and `.site-head__tag`.
`#ad4118` would clear it at 4.95:1.

### 3. The "source" link is a placeholder (`index.html:73`)

```html
<a href="https://github.com/" target="_blank" rel="noopener">source</a>
```

Points at github.com's homepage, not this repo.

## Accessibility

- **The phosphor toggle has no `aria-pressed`.** It's a stateful toggle
  button rendered as a plain `<button>`, so a screen reader announces
  "phosphor mode, button" identically whether it's on or off. Set
  `aria-pressed` and keep it in sync in `initPhosphorToggle()`.
- **Placeholder entries are real focusable links.** The two
  `.entry--placeholder` items in `index.html` use `href="#"`. `cursor:
default` hides this from mouse users, but they're still in the tab order
  and still announce as links; activating one jumps to the top of the page.
  Make them non-links (a `<span>`) until they point somewhere.
- **Reduced-motion is read once.** Both scripts snapshot
  `matchMedia(...).matches` at load and never listen for `change`, so
  toggling the OS setting doesn't take effect until reload. Minor, but
  `addEventListener("change", ...)` is a two-line fix.

## Correctness / behavior

- **Resizing reshuffles the entire starfield** (`pages/starfield.js:90`).
  The resize handler calls `initStars()`, which regenerates all 160 stars at
  new random positions. Dragging a window edge re-randomizes the field
  continuously, and on mobile the address bar showing/hiding fires `resize`
  and wipes the field. Better: keep the stars and rescale their `baseX`/
  `baseY` proportionally. Debouncing would help either way.
- **`step()` is called twice under reduced motion**
  (`pages/starfield.js:105-113`). Line 107 already draws the still frame;
  since `prefersReducedMotion` suppresses the `requestAnimationFrame`, the
  guarded second call at line 112 just draws a near-identical frame over it.
  The comment describes what line 107 does. Delete the trailing block.
- **`pointerleave` on `window` is unreliable** (`pages/starfield.js:100`).
  The event doesn't bubble, and the conventional target for "pointer left
  the page" is `document`/`documentElement`, not `window`. I did not
  reproduce this one, so treat it as worth verifying rather than confirmed —
  the symptom would be the field staying pulled toward the last known cursor
  position after the pointer exits.
- **`setInterval(draw, 120)` is never cleared** (`js/main.js:51`) and
  allocates a fresh ImageData eight times a second for the page's lifetime.
  Harmless on a page with no teardown, but reusing one buffer and driving it
  off `requestAnimationFrame` would be cheaper and would pause in background
  tabs.

## Polish

- **`100vh` on mobile** (`pages/starfield.html:15`) combined with
  `overflow: hidden` means the piece is clipped by dynamic browser chrome.
  `100dvh` is the fix.
- **Font preconnect is incomplete and inconsistent.** `index.html`
  preconnects to `fonts.googleapis.com` but not `fonts.gstatic.com`
  (crossorigin), which is where the font files actually come from —
  so the connection that matters isn't warmed. `starfield.html` has no
  preconnect at all while loading the same stylesheet.
- **No `<meta name="description">`, no Open Graph tags, no favicon** on
  either page. Browsers will request `/favicon.ico` and 404.
- **README structure drift.** The tree is rooted at `site/` and the deploy
  section says to drag "the `site/` folder", but everything lives at the
  repo root. Worth correcting before it confuses a future deploy.

## Repo hygiene

Still missing, in rough priority order:

1. **`.gitignore`** — nothing ignores `node_modules/` yet, and the README
   tells contributors to run `npx prettier`. One stray `npm install` and the
   tree gets noisy.
2. **CI** — a GitHub Actions job running `prettier --check` on pull
   requests. The formatting is currently clean (verified), so this locks in
   a property that already holds.
3. **Deploy** — no Pages workflow, no `netlify.toml`, no `CNAME`. The README
   describes the options but nothing is wired up, so the site isn't live.
4. **`LICENSE`** — optional for a personal site, but worth a deliberate call.

## What's already good

Worth not regressing:

- Prettier config is committed and the tree fully complies — `prettier
--check` passes on every file.
- Real design tokens in `:root` with a coherent second theme layered over
  them, rather than hardcoded colors scattered through the rules.
- `:focus-visible` outlines are defined for both the toggle and entry links,
  and the starfield's back link — keyboard navigation was thought about.
- Semantic structure throughout: `header`/`main`/`footer`, the directory as
  an `<ol>`, `lang="en"`, `rel="noopener"` on the external link,
  `aria-hidden` on the decorative canvas.
- Reduced-motion is handled in three places (CSS blanket rule, both
  scripts). The implementation has the gaps noted above, but the intent is
  consistently there.
- Genuinely no build step. Cloning and opening `index.html` works.

## New piece: cg–20 character generator

Added 2026-08-22 as entry `02` in the index:
`pages/character-generator.{html,css,js}`. It rolls a complete level 1
D&D character from SRD 5.2.1 data and lays the result out the way the
2024 character sheet does — abilities and their skills down the left,
combat in the middle, features and training on the right — wrapped in a
teenage-engineering-style front panel.

How it works, in one paragraph: the character is a pure function of five
short seeds (name / species / class / background / stats) plus the ability
score method. Those seeds, printed with dashes, are the serial number on
the panel and the URL fragment, so a link rebuilds the exact same
character. The DIP switches hold a channel's seed across a roll. Nothing
is stored anywhere else — no cookies, no `localStorage`.

Deliberate choices worth remembering:

- **First piece with its own stylesheet.** `character-generator.css`
  defines a page-local `:root` palette (bone panel, orange key, small
  black display) instead of the shared paper/ink one. `style.css` still
  supplies the type stacks. This is the "every page is allowed to be its
  own thing" rule being used on purpose.
- **Contrast was checked, not assumed.** Every text pair on the page
  clears 4.5:1 — including the two cuts of orange: `--orange` for fills
  and indicator dots, `--orange-text` (darker) wherever orange is
  actually text.
- **Reduced motion.** The only animation is the display "searching" for
  a moment before it settles; with `prefers-reduced-motion` the sheet is
  written immediately instead. The bar meters still show the final
  scores either way.
- **Print styles.** Printing hides the panel and prints the sheet in two
  columns, because a character sheet you can't print is a bit of a joke.

Open items:

1. **Proofread the rules data against the PDF.** The SRD 5.2.1 data
   (species traits, class kits, backgrounds, spell lists) was written out
   by hand; `media.dndbeyond.com` is blocked from the network this was
   built on, so none of it was diffed against the source document. The
   class starting-equipment packages and the level 1 spell lists are the
   most likely places for a slip.
2. **Level 1 only.** Nothing scales, and there's no level control. That's
   a scope choice, not an oversight — levels 2+ need class tables the
   panel has no room for.
3. **Backgrounds always take the 50 GP option** rather than the
   equipment package, because the packages aren't in the data yet.
4. Attribution is in the page footer and required by CC BY 4.0 — don't
   drop it when editing.
