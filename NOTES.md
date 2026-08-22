# Repo Notes — review of `main`

Reviewed commit: `4b96f26` ("Initialize STATIC personal website")
Date: 2026-08-22

STATIC is a hand-written static site: no framework, no build step, no
dependencies. Seven files, ~800 lines total. Prettier is the only tooling.

This note records what I found reading through it. Nothing here is fixed —
it's a list, roughly in the order I'd tackle it.

## Verified bugs

> **Status:** items 1, 2 and 3 are **fixed**; see the notes inline. Item 4
> and most of what follows is still open — individual items are marked.

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

### 3. The starfield canvas was `dpr x` too wide (`pages/starfield.html`) — FIXED

Found while checking the distortion panel at mobile widths. `#stars` set
`position: absolute; inset: 0` but no `width`/`height`. For an absolutely
positioned **replaced** element, `width: auto` resolves to the element's
_intrinsic_ width — for a canvas that's the `width`/`height` content
attributes, which this page sets in device pixels. So `inset: 0` never
stretched it:

| deviceScaleFactor | canvas CSS width | viewport |
| ----------------- | ---------------- | -------- |
| 1                 | 390              | 390      |
| 3                 | 1170             | 390      |

It looked correct at DPR 1 only because the attribute happened to equal the
viewport width. Everywhere else the element overflowed and the field was
effectively cropped. Same family as bug 1.

Fixed by adding explicit `width: 100%; height: 100%` alongside `inset: 0`.
Verified: canvas CSS box now equals the viewport at DPR 1, 2 and 3, no
horizontal overflow, and stars land in all four quadrants.

### 4. The "source" link is a placeholder (`index.html:73`)

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
- ~~**`step()` is called twice under reduced motion.**~~ **FIXED.** The
  draw loop was restructured when the distortion sliders were added:
  `frame()` now only paints, and `loop()` is what schedules itself, so
  reduced motion simply calls `frame()` once. The sliders also repaint that
  still frame on every change, so they keep working with no loop running.
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

- ~~**`100vh` on mobile.**~~ **FIXED** — `pages/starfield.html` now sets
  `100dvh` with a `100vh` fallback. This became load-bearing once the
  distortion panel was anchored to the bottom of that page.
- **Font preconnect is incomplete on `index.html`.** It preconnects to
  `fonts.googleapis.com` but not `fonts.gstatic.com` (crossorigin), which is
  where the font files actually come from — so the connection that matters
  isn't warmed. `starfield.html` **is now fixed** (it had no preconnect at
  all); `index.html` still needs the same two lines.
- **No `<meta name="description">`, no Open Graph tags, no favicon** on
  either page. Browsers will request `/favicon.ico` and 404.
- **README structure drift.** The tree is rooted at `site/` and the deploy
  section says to drag "the `site/` folder", but everything lives at the
  repo root. Worth correcting before it confuses a future deploy.

## Repo hygiene

1. ~~**`.gitignore`**~~ **Done.** Ignores `node_modules/`, npm logs, and OS
   and editor cruft. The point is to keep the "no runtime dependencies"
   claim true after someone runs `npx prettier`.
2. ~~**CI**~~ **Done.** `.github/workflows/ci.yml` runs on every pull
   request and on pushes to `main`. Three checks:
   - `prettier --check`, pinned to 3.9.6 and covering `html,css,js,json,md`.
     Pinned because there is no `package.json` to lock a version in, so an
     unpinned `npx prettier` would let an upstream release turn CI red with
     no commit behind it. README and CLAUDE.md name the same version and
     glob, so running the documented command is always enough.
   - `.github/scripts/check-links.mjs` — resolves every local `href`/`src`
     in every HTML file. The index is hand-ordered with no build step, so a
     renamed page in `pages/` otherwise breaks a link silently. Remote URLs
     are deliberately not fetched: CI should not depend on the network.
   - A guard that no `package.json` or `node_modules` has appeared and
     `index.html` still exists — the no-build-step rule asserted rather
     than trusted.
3. **`.gitattributes` was the prerequisite.** Git stores this tree as LF,
   but a Windows clone with `core.autocrlf=true` checks it out as CRLF, and
   `prettier --check` then fails on files nobody touched while CI on Linux
   passes. `* text=auto eol=lf` makes every checkout agree. This was a real
   papercut, not a hypothetical — it produced five phantom failures.
4. **`main` is not protected, and cannot be yet.** Branch-per-change is the
   convention, but the remote does not enforce it: the repo is private on a
   free plan, and both the branch-protection and rulesets APIs return 403
   "Upgrade to GitHub Pro or make this repository public". Making it public
   or upgrading are the only two ways to get a real gate; both are a
   deliberate call, not a default. Until then CI reports on PRs but nothing
   stops a direct push to `main`.
5. **Deploy** — no Pages workflow, no `netlify.toml`, no `CNAME`. The README
   describes the options but nothing is wired up, so the site isn't live.
6. **`LICENSE`** — optional for a personal site, but worth a deliberate call.

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
  defines a page-local `:root` palette (bone panel, red key, small
  black display) instead of the shared paper/ink one. `style.css` still
  supplies the type stacks. This is the "every page is allowed to be its
  own thing" rule being used on purpose.
- **Contrast was checked, not assumed.** Every text pair on the page
  clears 4.5:1 — including the two cuts of red: `--signal` for fills
  and indicator dots, `--signal-text` (darker) wherever red is
  actually text. `--rule` is 1.3:1 and is a border colour only.
- **Reduced motion.** The only animation is the display "searching" for
  a moment before it settles; with `prefers-reduced-motion` the sheet is
  written immediately instead. The bar meters still show the final
  scores either way.
- **Print styles.** Printing hides the panel and prints the sheet in two
  columns, because a character sheet you can't print is a bit of a joke.
- **A second knob picks the campaign setting.** Generic, Forgotten
  Realms, Greyhawk, Dark Sun, Dragonlance. Right now it **only re-skins
  the panel** -- nothing in `SETTINGS` reaches `buildCharacter`, so every
  setting still rolls a generic SRD character, and the fieldset says so
  in as many words. When it does start filtering species and adjusting
  bonuses, `SETTINGS` is where that data hangs.
- **One knob implementation, two knobs.** A knob is
  `[data-knob="<group>"]` driving the radios named `<group>`, so the same
  code runs the 2-position ability-score switch and the 5-position
  setting switch. The detent marks are drawn by `drawKnobTicks` from the
  same angle maths that turns the dial, rather than written out in CSS,
  so a knob cannot drift out of step with its own ticks.
- **Generic adds nothing to the serial.** The setting letter is appended
  only when it isn't generic, so every serial minted before settings
  existed is still byte-identical and still rebuilds the same character.
  An unknown setting letter is refused rather than silently ignored.
- **Every palette was computed, not eyeballed.** Four of the five needed
  their signal colour darkened to clear 4.5:1 -- Dark Sun's orange failed
  at 3.60 on the panel before it was solved for. Generic is the base
  `:root` palette and isn't repeated.
- **Pasted serials work in an open tab.** A `hashchange` listener rebuilds
  the character, so the piece's central claim -- that the link rebuilds
  this exact character -- holds whether you open the link fresh or paste
  it into a tab that is already up. `commit()` writes the hash with
  `history.replaceState`, which does not fire `hashchange`, so the
  listener only ever sees a change the reader made. A hash that isn't a
  valid serial is refused and the real one is put back, rather than
  leaving the address bar describing a character that isn't on screen.
  Back and forward work as a side effect.
- **The ability-score selector is a knob, not radio buttons.** A rotary
  switch is what the panel would actually have. The radios are still the
  real control though: they hold the value, take focus, and answer to the
  arrow keys, and the dial is turned to match. The knob is `aria-hidden`
  and is a second way to drive them (click steps, drag turns, wheel
  steps), never the only way. The inputs are hidden with the same clip
  technique as `.sr-only` rather than `opacity: 0` or `display: none`,
  because they have to stay focusable. `KNOB_SPREAD` and the detent maths
  are written for N positions, so a third method is a data change rather
  than a rewrite.
- **The display has a lamp bank.** The empty right-hand third of the LCD
  now carries one lamp per switch on the deck: five holds, the two
  ability-score modes, and the setting. They are a readout, not a second
  set of controls -- the display is `aria-hidden` and every lamp has a
  real input under it, with the status line still doing the speaking.
  Lit is a filled glyph in `--screen-fg`, unlit a hollow one in
  `--screen-dim`, so the state never rests on colour alone, and both
  label states stay on a token that clears AA. The glyphs are inline SVG
  drawn in `currentColor`, so a skin re-tints them for free.
- **Each setting re-cuts the key legends.** `--legend`, `--legend-size`
  and `--legend-weight` sit beside the colour tokens in every skin:
  Grenze Gotisch for generic, Cinzel for the Realms (inscriptional
  Roman, the grey box lineage), IM Fell English for Greyhawk (17th
  century Fell types, ink spread and all, for the 1e look), Metamorphous
  for Dark Sun (carved and sun-scorched, after Brom), Almendra for
  Dragonlance (calligraphic, romantic). Size and weight are per-skin
  because the five faces are nowhere near each other at a shared size.
  Body copy and the sheet are untouched -- this is the panel's lettering
  only. The faces come from the same Google Fonts link the page already
  had, so it is still no build step and no install.
- **A held name keeps its species.** Holding a channel freezes its seed,
  but the name is drawn from the species' name bank, so re-rolling
  species used to rename a character the panel said was held. Rolling
  species while the name is held now pins the name to the species it was
  drawn from, and rolling the name releases the pin. The pin rides in the
  serial as a trailing `N<index>` group, written only when it is actually
  in force -- same rule as the setting letter, so no serial minted before
  it changes shape. Ability scores are a milder case of the same thing
  and were left alone: the pool is held, but the arrangement follows the
  class, which is what D&D does. The panel note says both out loud.
- **The PDF is written by hand.** `export` builds a real PDF as a string
  and hands it over as a blob: base-14 fonts so nothing is embedded, all
  text escaped to WinAnsi so the file stays ASCII and a string index is a
  byte offset for the xref table, two-column flow with page breaks. It is
  the CG-20's own sheet, not the official 2024 form -- filling that would
  need a PDF library and WotC's file in the repo, which breaks the
  no-dependency rule and redistributes something that isn't SRD. Layout
  and content are separate: `sheetSections` knows D&D and no points,
  `pdfRow` knows points and no D&D.

Open items:

1. ~~**Proofread the rules data against the PDF.**~~ **Done 2026-08-22.**
   The SRD was fetched and diffed against the data. Five things were
   actually wrong and are now fixed:

   - Dragonborn Breath Weapon was `2d6`; SRD 5.2.1 is `1d10`.
   - Dragonborn breath _shape_ was pinned per ancestry colour (Gold =
     Cone, Black = Line, and so on). That's a 2014 rule. The Draconic
     Ancestors table sets the damage type only; the shape is chosen at
     each use, so the notes now read "Acid damage" and the trait line
     carries "15 ft. Cone or 30 ft. Line".
   - Druid armour training said `Shields (nonmetal)`. The 2024 rules
     dropped the metal taboo — it's "Light armor and Shields".
   - Wizard's skill list was missing Nature (SRD offers 7, we listed 6).
   - Sickle was `1d6`; it's `1d4`.

   Also removed eight spells that appear **nowhere** in SRD 5.2.1, so a
   roll can no longer hand you a spell with no rules text to look up:
   Blade Ward, Thorn Whip, Witch Bolt, Hail of Thorns, Armor of Agathys,
   Arms of Hadar, Thunderous Smite, Wrathful Smite. Every spell the
   generator can now roll was machine-checked against the SRD list for
   its class — 0 off-list.

   Checked and correct, for the record: all nine species (bar the
   dragonborn breath above), every class's core traits table (hit die,
   saves, skill list, weapon/armour training, starting kit and GP), the
   weapon and armour tables, the standard array and 4d6-drop-lowest, the
   background +2/+1 spread capped at 20, HP, AC, initiative with Alert,
   spell save DC and attack bonus, Hunter's Mark, and the subclass names.

2. **The generator is wider than the SRD, and the spec row overstates
   the licence.** Deliberate, but worth knowing: 12 of the 16
   backgrounds, 8 of the 12 origin feats, and 2 of the 6 fighting styles
   (Dueling, Protection) are 2024 PHB content that is _not_ in SRD 5.2.1
   and _not_ covered by CC BY 4.0. The SRD has only four backgrounds
   (Acolyte, Criminal, Sage, Soldier — all four correct here) and four
   origin feats (Alert, Magic Initiate, Savage Attacker, Skilled). Note
   that `maxHp` grants +2 for **Tough**, which is one of the non-SRD
   feats. If the "rules: SRD 5.2.1 — CC BY 4.0" row is meant literally,
   this is the thing to resolve — either cut the extra content or
   reword the row.

3. **Level 1 only.** Nothing scales, and there's no level control. That's
   a scope choice, not an oversight — levels 2+ need class tables the
   panel has no room for.
4. **Backgrounds always take the 50 GP option** rather than the
   equipment package, because the packages aren't in the data yet. This
   is legal — the SRD offers exactly that choice — and the sheet says so.
5. Attribution is in the page footer and required by CC BY 4.0 — don't
   drop it when editing.

Restyled 2026-08-22 against the actual EP–1320 product page rather than
a general impression of the brand. Colours, the 3px frame weight, the
4px corner radius and the absence of letter-spacing are all sampled from
teenage.engineering's own computed styles: bone `#dcd8cf`, near-black
rule `#231f20`, signal red `#b22e20`, oxblood `#3e1815`. Body face is
Space Grotesk standing in for their proprietary te-20; the blackletter
accent stays UnifrakturMaguntia, which is doing the job their "swingus"
does on the medieval unit.
