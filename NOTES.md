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

- ~~**Resizing reshuffles the entire starfield** (`pages/starfield.js:90`).~~
  **FIXED.** The resize handler used to call `initStars()`, which
  regenerated all 160 stars at new random positions on every resize event —
  dragging a window edge re-randomized the field continuously, and on
  mobile the address bar showing/hiding fired `resize` and wiped the field.
  It now rescales existing stars' `baseX`/`baseY` proportionally to the new
  dimensions instead of discarding them, and is throttled to one update per
  animation frame via `requestAnimationFrame` rather than firing on every
  intermediate resize event.
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
- ~~**`setInterval(draw, 120)` is never cleared** (`js/main.js:51`) and
  allocates a fresh ImageData eight times a second for the page's
  lifetime.~~ **FIXED.** The draw loop now runs off `requestAnimationFrame`,
  gated to the same ~120ms cadence, reuses one `ImageData` buffer instead of
  allocating a new one every tick, and stops entirely on `visibilitychange`
  while the tab is hidden rather than burning cycles in the background.
- ~~**Knob dragging reads layout on every `pointermove`**
  (`character-generator.js`, `pointerAngle`).~~ **FIXED.** Both knob-drag
  handlers (`wireKnob` and `wireDials`) called `knob.getBoundingClientRect()`
  on every pointer move during a drag — a forced synchronous layout read per
  event. The knob doesn't move or resize mid-drag, so the rect is now
  measured once on `pointerdown` and reused for the rest of that drag.

## Polish

- ~~**`100vh` on mobile.**~~ **FIXED** — `pages/starfield.html` now sets
  `100dvh` with a `100vh` fallback. This became load-bearing once the
  distortion panel was anchored to the bottom of that page.
- ~~**Font preconnect is incomplete on `index.html`.**~~ **FIXED.** It only
  preconnected to `fonts.googleapis.com`, not `fonts.gstatic.com`
  (crossorigin) — the origin the font files actually download from, so the
  connection that mattered wasn't warmed. `index.html` and
  `character-generator.html` both now carry the second preconnect line;
  `starfield.html` already had it.
- ~~**No favicon on any page.**~~ **FIXED.** All three pages (`index.html`,
  `starfield.html`, `character-generator.html`) now link a small inline-SVG
  favicon (four phosphor-green squares on the dark background — a nod to
  the "static" theme), so a load no longer wastes a request on a 404'ing
  `/favicon.ico`. `<meta name="description">` and Open Graph tags are still
  open.
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
- **The machine has a port strip.** Every box this thing is modelled on
  has jacks along its top edge, and that strip is the part that says the
  machine isn't the whole story. There are five, each opening a drawer
  that slides out from under the strip: OUTPUT, INPUT, SYNC, AUX, MIDI.
  A chip lights when something is actually plugged into it, not merely
  when its drawer is open.
- **OUTPUT is where the sheet leaves.** The copy and export keys moved
  off the deck into its drawer, and a third key joined them: **json**.
  The JSON is deliberately the _sheet_ as data -- every number a consumer
  would want (saves, all eighteen skill modifiers, passives, attacks,
  spellcasting or null) -- and not a dump of the generator's tables. A
  species in it is a name and a size, not the whole SRD entry; anything
  that wants to rebuild the machine should use the serial, which is in
  the file along with the CC BY attribution. All three exports share one
  `downloadFile`/`exportName` pair and name files `<slug>-<serial>.<ext>`.
- **INPUT is five seed dials.** It began as five text fields -- paste
  anything, get a character -- but a text box was the least tactile thing
  on a panel built out of knobs, so it became an endless encoder per
  channel. Each dial keeps an _anchor_ (the seed the channel held when
  dialling began) and an offset either side of it, so the walk is
  reversible: turn back and the character you just passed comes back
  exactly, which a stream of fresh random seeds could never do. The dial
  re-anchors itself whenever the channel's seed moves by some other route
  -- a roll, a take, a link -- by noticing that the seed is no longer the
  one its offset predicts. Nothing has to tell it.
  Dialling engages the channel's hold, because a value set by hand
  shouldn't be overwritten by the next roll. It commits without the
  search animation and records no take: a spin would otherwise scramble
  the display once per detent and bury the sixteen-slot reel. The dial is
  its own undo -- turn it the other way.
  It is also the first knob on the panel that is a real control rather
  than a pointer affordance over hidden radios. The mode knobs _choose_
  from a list, so radios were right; this one _steps_ a value, so it is a
  `spinbutton` that takes focus itself and answers to the arrow keys.
- **A patched species is a species change.** The name pin added earlier
  lived inside `rollChannels`, but rolling is no longer the only way a
  channel moves. That logic is now `pinNameFor`, called by both paths, or
  a patched species would quietly rename a held name -- exactly the bug
  the pin was built to stop.
- **SYNC: one serial, a whole party.** `P<n>` on the end of the serial,
  2 to 6. Member one is the machine itself; the rest derive from the
  serial it would have on its own, so the party group can't feed its own
  derivation. Every member also spells a serial of its own, which is what
  the pull button loads -- so one link rebuilds the set, and each member
  is still a first-class character with a link of their own.
- **AUX cartridges clamp what can be rolled.** `CARTRIDGES` is a table
  like `SETTINGS`: casters only, no magic, no humans, small folk,
  frontline. A cartridge changes what a seed produces, so unlike the
  setting knob it genuinely has to be in the serial (`X<index>`) or an
  old link would rebuild a different character. The selector is the
  existing knob -- `wireKnob` was already written for N positions, so a
  third switch needed no new knob code. A filter that emptied a list
  would break the machine, so an empty result falls back to the full one.
- **The serial grew a tail parser.** Three optional groups was one too
  many to pop by hand. `SERIAL_TAIL` is a table keyed by letter -- `P`
  party, `X` cartridge, `N` name pin -- read off the end in any order and
  written in a fixed one, so a given state always spells the same serial.
  A seed is always four characters and a tail group is at most three, so
  they can never be confused. Out of range, repeated, or unknown groups
  are refused rather than ignored. Serials minted before any of this
  still parse as the shorter thing they are, which was checked.
- **MIDI is real, and honest when it isn't there.** `requestMIDIAccess`
  is a browser API, not a library, so it costs the no-dependency rule
  nothing. Notes map `note % 5` onto the five channels. Access is asked
  for only when the reader presses connect -- a permission prompt on page
  load would be rude -- and the port reports `no device`, `not available
in this browser`, or `needs https or localhost` rather than failing
  silently. **This is the one thing on the page that a clone opened
  straight off disk cannot do**: `file://` is not a secure context.
  Everything else still works exactly as it did.
- **The drawer slides on a timer, not on `transitionend`.** `0fr` to
  `1fr` is the only way to animate to a height nobody measured, and the
  `hidden` attribute is still what closes a drawer, so nothing inside a
  shut one stays in the tab order. Re-hiding waits out `BAY_SLIDE_MS`
  rather than listening for the transition, because that event can simply
  never arrive -- a backgrounded tab runs no transitions -- and a drawer
  stuck half-open in the tab order is worse than one that shuts a frame
  early. `prefers-reduced-motion` skips the wait entirely.
- **One new colour pair, measured.** The drawers put `--ink-soft` on a
  surface it had never landed on: on `--panel-sunk` it is 4.15:1 in the
  Realms skin and fails. The whole drawer is `--card` instead, where the
  worst skin is 5.94:1, and fields are told apart by their border rather
  than a second background -- which the hairline was doing everywhere
  else on this panel anyway. All 22 text nodes across the four drawers
  were measured in all five skins.
- **The tactile pass.** Six controls, one design rule: knobs for
  choices, sliders for amounts, momentary keys for gestures, latching
  keys for states -- and anything that changes what comes out of the
  machine rides in the serial, while performance and feel controls
  deliberately do not.
  - **The scores knob has four detents now** -- standard array, 3d6
    gritty, 4d6 drop lowest, and heroic (4d6, each 1 rerolled once).
    The serial's method letter grew A/R -> A/G/R/H; old serials parse
    unchanged. Different methods draw different dice counts from the
    stream, which is fine because the method is in the serial.
  - **A flourish knob sets how ornamented a name may be** -- plain,
    weathered, baroque (epithet chance 0 / 0.28 / 0.6). Weathered is the
    old hard-coded value and the default, so pre-knob serials spell the
    same names. Off-default rides as a trailing `F<index>` group.
  - **The machine keeps takes.** Sixteen serials in memory, nowhere
    else; the take keys step back and forth, and a new roll after
    stepping back records over the tape. A serial arriving by hash
    starts a fresh reel. The LCD foot shows `tk n/m`.
  - **Audition is a momentary key** -- hold to preview a phantom roll on
    the display only (sheet, serial and address bar stay put), release
    to discard, press roll (or r) while holding to keep. The r-shortcut
    guard makes an exception for the held audition key on purpose.
  - **A transport plays the machine** -- latching play, three-detent
    tempo. Every tick rolls the open channels through the same path a
    hand-roll takes, so each one is a real serial on the take reel. Any
    manual roll stops the reel. Reduced motion disables the key and says
    so on it.
  - **Two faders** -- glow (scanline opacity against display brightness,
    deliberately stateless: a reload is a power cycle) and the party
    size, which stopped being a number input. One shared fader style:
    rectangular caps, because circles are for knobs.
  - **The display gained an operator.** Every pocket operator's LCD
    keeps a little figure who works the machine; ours rattles a die in
    the bright phosphor while the panel is busy, two frames on steps().
    Reduced motion never starts the flip, so frame one just stands
    there, which still reads as intended.
  - One bug caught in verification: `applySerial` restored every tail
    field except the new flourish, so a baroque link rebuilt a weathered
    character. The radios were synced from state, which hid it -- the
    fix is one line, and the lesson is the same as the name pin's:
    every field the serial carries must round-trip through applySerial.
- **Every knob lives in the aux drawer now, and none of them are
  labelled.** The panel had grown a column of fieldsets down its right
  side, each knob explaining itself in a list of words beside it. That is
  not what the machines this thing is modelled on do: they put the
  controls out and let the display say what is going on. So the five
  knobs -- cartridge, ability scores, setting, flourish, tempo -- moved
  into the aux bay in one row, the option lists went away, and the lamp
  bank grew a tempo group so that every knob on the machine is now
  reported on the display. Turning one is how you find out what it does.
  Three things keep that from being merely obscure:
  - **The radios are clipped, not removed.** Same `.sr-only` technique
    the panel already used, so every option keeps its name for a screen
    reader, stays in the tab order, and still answers to the arrow keys.
    Measured at 1x1 with the labels intact -- invisible, not gone.
  - **Colour tells the knobs apart, never what they mean.** Five caps cut
    from tokens each skin already defines, so they stay distinguishable
    in all five palettes without a new token. The lamps carry the
    meaning, so nothing here rests on colour alone. The pointer flips
    light or dark to stay legible on its own cap: weakest pair measured
    at 4.6:1, well past the 3:1 a graphic needs.
  - **The one honest disclosure stayed.** The setting knob only re-skins
    the panel, and the fieldset used to say so in as many words. Dropping
    that with the other labels would have let the machine imply the
    setting does more than it does, so the sentence moved to the note
    under the serial rather than disappearing. Not spelling things out is
    a style; misleading someone is not.
- **The knobs moved out from under aux to under the display, and got
  their names back.** Each knob is labelled; no _position_ is. The word
  sits on the panel under the cap, where a finger cannot cover it, the
  same placement the transport keys use. Aux is empty and deliberately
  TBD -- most likely whatever the next machine on this site wants to hand
  to this one.
- **A sixth knob in the input drawer sets the level, 1 to 5.** It is not
  a seed dial, so it is a five-position switch that looks like the mode
  knobs rather than the encoders beside it. Level rides in the serial as
  a trailing `L<n>`, written only above 1, so pre-knob serials still spell
  the same character. `PROFICIENCY_BONUS` stopped being a module constant
  and became `character.proficiency`, computed per level and read off the
  character by every renderer and exporter.
  What the level actually drives: proficiency bonus (+3 at 5), hit points
  by fixed average per level, the ability score improvement at 4 spent on
  the class's first-priority ability, subclass at 3, and spell slots,
  cantrips and prepared counts per class per level, including warlock
  pact magic on its own table.
  **One deliberate output change:** the sheet used to print a subclass at
  level 1. Every 2024 class takes its subclass at 3, so it now appears
  only from 3 up -- which means an old level 1 link renders without the
  subclass line it used to show. That is the same trade the SRD proofread
  made when it corrected the dragonborn breath weapon: the rules win.
- **The level knob worked; the panel lied about it.** Shipped in the
  previous change and reported straight away as "doesn't seem to do
  anything". It did: hit points and proficiency were scaling correctly.
  What was broken is everything that _says_ the level -- the sheet's level
  field was never written, the display's build line had `level 1` hard
  coded, the spell-slot line printed the level 1 count, the announcement
  and the PDF export said level 1, and the features gained on the way up
  were computed into `character.levelFeatures` and then thrown away by a
  `fillList` that still concatenated the subclass by hand.
  Cause: a single edit script wrote nothing, and nobody checked the file
  afterwards. The lesson is not about levels. **After a scripted edit,
  grep the file for each change before believing it landed** -- an
  assertion that passes proves the match, not the write.
- **The lamp bank clusters instead of stacking.** On a wide panel it ran
  as one tall column pinned to the right edge with the middle of the
  display empty. Each head and its lamps are now wrapped in a
  `.lampgroup` so a column break cannot separate them, and above 60rem
  the bank flows `column wrap` against a capped height: the groups spread
  into as many columns as they need. At 1280px that is four columns,
  136px tall, against the 470px single column it was. Narrow screens keep
  the row-wrap layout they already had.

Open items:

1. **Proofread the level 2-5 tables against the SRD.** Every other number
   in `character-generator.js` was diffed against the document, and five
   real errors fell out of that pass. The new level tables have _not_ had
   it -- the fetch was blocked by a spend limit when they were written,
   so they are written from knowledge of the 2024 rules and are marked
   unverified in the file itself. What needs checking: cantrip and
   prepared-spell counts per class per level, the class feature lists for
   levels 2-5, and the half-caster slot column. The level 1 column is the
   old proofread data and is sound.

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

1. **The generator is wider than the SRD, and the spec row overstates
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

1. **Level 1 only.** Nothing scales, and there's no level control. That's
   a scope choice, not an oversight — levels 2+ need class tables the
   panel has no room for.
1. **Backgrounds always take the 50 GP option** rather than the
   equipment package, because the packages aren't in the data yet. This
   is legal — the SRD offers exactly that choice — and the sheet says so.
1. Attribution is in the page footer and required by CC BY 4.0 — don't
   drop it when editing.

- **The setting knob stopped being cosmetic.** It re-skinned the panel,
  re-cut the legends, lit a lamp and wrote a letter into the serial, and
  reached `buildCharacter` not at all -- the note under the serial said so
  in as many words, which was the honest disclosure that survived the
  label cull. It now narrows what can be rolled and changes who comes
  back, so that sentence is gone and the note says what the knob actually
  does.
  What a setting can carry: species and class filters (the same signature
  a cartridge's take), per-species name banks, its own epithets, a list of
  homelands, and subclass renames by class id. Every field is optional and
  every one falls back, so generic carries none of them and stays the
  absence of a setting rather than one of five. Greyhawk drops the
  dragonborn and the goliath; dark sun drops the gnome, dragonborn,
  tiefling and orc, and the cleric and paladin with the gods; dragonlance
  drops the orc, goliath, dragonborn, tiefling and warlock; the realms
  refuse nothing, which is their whole character.
- **Two species were added, and they belong to one world each.** A
  half-dwarf on Athas and the roadkin on Krynn. A species now carries an
  optional `settings` list -- no list means everywhere, which is what all
  nine SRD entries are, so the generic roster filters down to exactly
  those nine in their original order. **New entries are appended, never
  inserted:** the serial's name pin is a raw index into `SPECIES`, so an
  insert would rewrite every serial that carries an `N`. Both come with a
  `NAME_BANKS` entry, which is not optional -- `buildName` reads that table
  unguarded and throws for a species that is missing from it.
  Two hard-coded species checks became fields on the way past:
  `species.id === "dwarf"` for the extra hit point per level is now
  `hpPerLevel`, and `keenSenses` grew an optional `keenSenseLabel` so the
  roadkin's version is not called Keen Senses. The `small folk` cartridge
  stopped naming gnomes and halflings and started testing size, so a
  setting's own small folk are caught without that entry knowing they
  exist.
- **No new classes; renamed subclasses instead.** A `CLASSES` entry needs
  a kit, features, an `ABILITY_PRIORITY` row, a `LEVEL_FEATURES` row and,
  for a caster, a whole spell list and progression -- that is authoring a
  class, and it is not what buys the setting feel. The `subclass` string
  every class already carries does. `subclassFor` resolves it once in
  `buildCharacter` and the character carries it, which meant sweeping
  seven read sites off `character.cls.subclass`; the sheet and the PDF
  disagreeing is exactly what a half-finished sweep looks like.
- **The setting letter used to be cosmetic and is now load-bearing.** A
  serial minted before this change that carried a letter rebuilt a plain
  SRD character with a tinted panel; it now rebuilds a character of that
  setting. Letterless serials -- which is every serial minted before
  settings existed, and the majority since -- are untouched, and that was
  checked rather than assumed: 4000 generic states across every cartridge,
  method and level, fingerprinted on both sides of the change down to
  attacks, equipment and spell lists, came back identical.
- **The homeland draws from a stream of its own.** `makeRng("home/" +
seed.name + "/" + setting.id)` rather than one more `pick` off
  `backgroundRng` -- which is where the alignment draw sits, so appending
  there would have shifted it and quietly rewritten every character ever
  rolled. A new stream changes nothing that came before it.
- **Fixed in passing: derived party members were built at level 1.**
  `partyMember` copied the method, setting, cartridge, flourish and name
  pin but not the level, so every member past the first ignored the level
  knob and the serial its pull button spelled dropped the `L` group.

Restyled 2026-08-22 against the actual EP–1320 product page rather than
a general impression of the brand. Colours, the 3px frame weight, the
4px corner radius and the absence of letter-spacing are all sampled from
teenage.engineering's own computed styles: bone `#dcd8cf`, near-black
rule `#231f20`, signal red `#b22e20`, oxblood `#3e1815`. Body face is
Space Grotesk standing in for their proprietary te-20; the blackletter
accent stays UnifrakturMaguntia, which is doing the job their "swingus"
does on the medieval unit.

- **2026-08-24: declined to use real 2nd-edition proper nouns, on
  purpose.** Asked to reuse actual race/class/location names from the
  2e Greyhawk, Dark Sun, and Dragonlance sourcebooks and to drop the
  "not affiliated with Wizards of the Coast" line. Declined both: those
  three settings are not dormant IP -- WotC/Hasbro actively republish
  and sell them (Dragonlance got a full 5e hardcover in 2022), so
  copyright age isn't the question age alone doesn't answer, and
  continuous commercial use cuts against any abandonment reading
  anyway. The disclaimer is what keeps this an homage rather than a
  reproduction; pulling it while adding real proper nouns would remove
  the one thing doing that work. The SRD attribution line is a separate
  matter and stays regardless -- CC BY 4.0 requires it for the
  mechanical content actually in use.
  Did the flavor pass a different way instead: sharpened the already-
  invented regions, epithets, and subclass names for Greyhawk, Dark
  Sun, and Dragonlance (more of them, tighter to each setting's
  register), and added a dwarf name bank to Greyhawk and an elf one to
  Dragonlance for the same reason the human ones exist -- so the
  setting has its own voice, not just its human population.
  Also asked to add the Thri-Kreen to Dark Sun -- same problem, it's a
  WotC-coined creature name that's appeared as a playable race in
  current 5e books, not a generic fantasy word. Followed the project's
  own precedent instead (`half-dwarf` and `roadkin` are both original
  species invented to fill a narrative slot rather than borrowed and
  renamed) and invented the **Carapan**: chitin-hided, desert-adapted,
  heals extra on a Long Rest, communicates by clicking rather than
  telepathy -- deliberately not the leaping/four-armed/telepathic
  cluster of traits that would read as "thri-kreen with the serial
  numbers filed off." `settings: ["dark-sun"]`, appended to the end of
  `SPECIES` per the append-only rule (the name pin is a raw array
  index), with its own `NAME_BANKS` entry alongside `half-dwarf` and
  `roadkin`.
  Verified with a 2400-build sweep across all three settings (buildCharacter,
  asPlainText, sheetSections, asJson, no page errors) rather than the usual
  before/after fingerprint diff, since the content was deliberately meant to
  change this time. Confirmed each setting's species/class exclusions still
  hold, every new subclass name surfaces, and Carapan appears at roughly the
  expected 1-in-7 rate for Dark Sun's roster.
- **2026-08-24, later the same day: the per-species name banks didn't
  travel with their setting.** Every non-human species left on a
  setting still fell back to the one generic name bank regardless of
  where it was rolled -- Dark Sun halflings came out shire-cozy (Pip,
  Merri, Rosa, kettles and orchards), Dark Sun elves came out lush
  forest, Dark Sun goliaths came out cold mountain, Greyhawk elves came
  out springtime, Greyhawk gnomes came out clockwork-tinker. Added five
  setting-specific banks to fix the ones that actually clashed: Dark
  Sun halfling (feral, small, fast -- teeth and thicket, not orchards),
  Dark Sun elf (wind and distance -- a desert nomad, not a wood elf),
  Dark Sun goliath (sun-scorched -- swapped Cloud/Frost/Peak for
  Sun/Stone/Scorch, there's no cold mountain on Athas), Greyhawk elf
  (autumnal and faded, fitting "a longer memory" instead of a young
  spring grove), Greyhawk gnome (rustic hedgerow instead of artificer
  clockwork). Left Forgotten Realms and the rest of Dragonlance's
  fallbacks alone -- Forgotten Realms' whole premise is "refuses
  nothing," so the default bank reading as the multiverse's baseline is
  correct there rather than a gap, and Dragonlance's remaining fallback
  (dwarf, on the generic forge/mining bank) doesn't clash with anything.
  Same rule as the Carapan and the earlier flavor pass: invented,
  setting-appropriate in register, no real 2nd-edition proper nouns.
  Verified with a 2000-sample sweep targeted at the five changed
  race/setting pairs -- zero build errors, and the actual generated
  names read distinctly on inspection (Dark Sun halfling: Thickettooth,
  Snarefang, Sharpbite; Greyhawk elf: Greyfall, Autumnspire, Frostvale).

## New piece: field notes

Added 2026-08-26 as entry `03` in the index: `pages/field-notes/`, plus an
unlinked `pages/admin/admin.html` and `netlify/functions/publish.mjs`.
Fills in the "field notes" placeholder that's been in `index.html` since
the beginning, with a working publish flow rather than more hand-written
HTML.

The one backend on the site. A shared secret gates a Netlify serverless
function that commits new post files straight to `main` via the GitHub
Contents API — see the "One narrow exception" section in `CLAUDE.md` for
why that's allowed to break the branch-per-change and Prettier-covers-
everything rules, and nothing else.

Deliberate choices worth remembering:

- **Zero npm dependencies in the function**, on purpose. Only built-in
  Node/Fetch APIs — no `package.json` anywhere in the repo, no SDK. This
  is what keeps "no runtime dependencies" true for the backend too, not
  just the pages a reader sees.
- **The secret is typed on every publish**, never stored in
  `localStorage`/`sessionStorage`. Smallest attack surface, simplest to
  build — the tradeoff is retyping it each time, which is fine at
  personal-site volume.
- **Post bodies are plain text only.** Blank line = new paragraph,
  everything else escaped and shown as literal text. No markdown, no
  inline formatting. Chosen explicitly over a hand-rolled markdown-lite
  formatter to keep the function's code small and match the site's plain,
  hand-written feel. Images, comments, and drafts are all out of scope
  for the same reason — none of them exist yet.
- **Four sequential commits, not one atomic one**, because the GitHub
  Contents API has no multi-file commit. Order matters: the new post page
  commits first, then `posts.json`, then the regenerated listing, then
  the regenerated feed last. A failure partway through therefore leaves
  the smallest possible mess — an orphan post page nothing links to yet —
  rather than a broken link advertised in the feed or the directory. This
  is an accepted tradeoff, not a bug to eventually fix; a fully atomic
  multi-file commit would need the much heavier Git Data API for a
  single-owner site where a failed publish is just retried by hand.
- **`posts.json`, `field-notes.html`, `feed.xml`, and every
  `posts/<slug>.html` are generated, not hand-written**, and are
  overwritten on every publish. `field-notes.css` is the one file in that
  folder that's safe to edit by hand — the function never touches it.
- **`.prettierignore` exempts the two generated HTML shapes** (the
  listing page and every post page) from the "whole tree complies" rule.
  Prettier's HTML printer is whitespace-sensitive in ways that are
  fragile to hand-match inside a template string, and getting it wrong
  would turn CI red after every single future publish — a recurring
  nuisance, not a one-time bug. `posts.json` stays in the normal
  prettier-checked set; `JSON.stringify(posts, null, 2)` matches
  Prettier's default JSON formatting closely enough that it didn't need
  the same exemption. `feed.xml` was never in Prettier's checked glob
  (`html,css,js,json,md`) to begin with.
- **The listing page reuses the home page's directory classes** —
  `.directory`, `.directory__list`, `.entry`, `.entry__num`, and so on —
  rather than inventing new ones, since a field notes index is the same
  "index of /" device one level down. The only new class is
  `.field-notes__empty`, and it lives in the hand-owned
  `field-notes.css`.
- **Two accepted, documented-not-solved risks.** The publish endpoint has
  no rate limiting beyond the shared secret itself — Netlify's free tier
  has no path-level access control, so a weak secret is guessable. And
  `posts.json` is read then written across two separate HTTP calls, so a
  concurrent publish could hit a GitHub `409` on a stale `sha`; harmless
  at single-owner scale, but real. (The second one still stands after the
  move to one atomic commit — see "Field notes: edit, unpublish, and one
  commit per action" below — it just fails differently now: a
  non-fast-forward rejection on the ref update instead of a stale-`sha`
  conflict on a single file.)
- **`tests/publish.test.mjs` is the project's first test file.**
  Everything else on this site is checked by hand or by CI's format/link/
  no-build-step guards; the publish function's generator logic (slug
  collisions, escaping, RSS structure, date formatting) can't be verified
  any other way without a live Netlify + GitHub deploy, which is exactly
  the situation a test earns its keep. Zero dependencies — `node:test`
  and `node:assert/strict` are both built in — so it doesn't compromise
  the no-runtime-dependencies rule either. Run with
  `node --test tests/publish.test.mjs`. It lives outside
  `netlify/functions/` deliberately: Netlify's function bundler deploys
  every file in that directory as a function, and rejected this one
  during a deploy because `.` isn't a valid character in a function
  name — see the deploy fix noted below.

Open items: the publish flow itself is unverified end-to-end, since that
needs a live Netlify site connected to this repo with real env vars set
(`PUBLISH_SECRET`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`) — see the
"Publishing setup" section of `README.md`. Everything checkable without
that (templates, escaping, the CI checks, the unit tests) has been.

## Field notes: link preview cards

Added 2026-08-26. A paragraph that's nothing but a URL now unfurls into a
preview card (title, description, thumbnail, domain) instead of sitting
there as plain text — the familiar Slack/Discord/Twitter "paste a link on
its own line" convention. A URL inside a sentence is auto-linked but
doesn't get a card, so cards don't litter the middle of a paragraph.

- **Fetched and baked in at publish time, not read time.** The function
  fetches each linked page's `og:title`/`og:description`/`og:image` (or
  falls back to `<title>`/`<meta name="description">`) once, when the
  post is published, and writes the result straight into the post's
  static HTML. Nothing fetches on a visitor's behalf — no CORS proxy, no
  client-side dependency, no per-pageview cost. Same reasoning as
  everything else about this feature: the function does by API what a
  human would otherwise do by hand, once, and the result is ordinary
  static HTML forever after.
- **Regex, not an HTML parser**, for pulling four meta tags out of a
  `<head>`. A real parser would mean an npm dependency for the one part
  of the site that's supposed to have none, and four tags don't need one.
- **A failed fetch still renders a box, just a minimal one** — domain and
  a bare link, no title/description/image — rather than silently
  reverting to a plain paragraph. Whether a link becomes a preview or a
  fallback, "a link on its own line is a box" holds either way.
- **Fetched in parallel, capped at 5 per post, 6-second timeout each,
  300KB of HTML read per fetch.** Parallel so the worst case is one
  timeout, not the sum of five; capped so a post with many links can't
  blow past the function's execution budget. None of this ever aborts
  the publish itself — `fetchLinkPreview` catches its own failures and
  returns `null`, which is exactly the fallback-box path.
- **Basic SSRF hygiene, not a hardened defense.** Non-http(s) schemes and
  a short list of localhost/private-IP-shaped hostnames are refused
  before fetching. This is proportionate, not bulletproof (no DNS-level
  check, so rebinding isn't covered) — the input source is the site
  owner's own trusted admin form, not public traffic, so the bar is
  "don't let a pasted link reach the function's own private network by
  accident," not "defend against a malicious author."
- **`--mint` almost became a hover text color and got caught.** The first
  pass of the inline-link styling switched to `--mint` on hover, which is
  2.59:1 on `--paper` — the same token NOTES.md already flagged as
  border-only, for the same reason `--phosphor-dim`/`--phosphor-line`
  are split. Fixed before it shipped: color stays on `--rust` in both
  states, the hover affordance is a thicker underline instead. Worth
  recording since it's exactly the mistake the split-token rule in
  `CLAUDE.md` exists to prevent, caught by re-reading that rule rather
  than by a contrast checker.
- **Verified with a local HTTP server, not just fixtures.** Redirect
  following, `res.url` reflecting the post-redirect address (for
  resolving a relative `og:image` correctly), 404 handling, non-HTML
  `content-type` rejection, and the byte-cap truncation were all
  exercised against a real (local, offline) server rather than asserted
  from reading the code — the byte cap in particular was confirmed to
  actually bound the read (requested 1000 bytes from a 1MB response, got
  exactly 1000 back) rather than being decorative.

## Field notes: edit, unpublish, and one commit per action

Added after a duplicate note went live and there was no way to take it
down except by hand-editing four generated files and pushing. Two new
endpoints, `/api/edit` and `/api/unpublish`, both driven from the same
unlinked `pages/admin/admin.html`, plus a fix to something the Netlify
build list made obvious.

- **Four builds per publish, now one.** Publishing touched four files,
  and the GitHub Contents API writes one file per commit — so one note
  produced four commits, four pushes, and four Netlify deploys (two
  "Completed", two "Skipped", all for the same note). Writes now go
  through the Git Data API instead: blob contents into a tree, one
  commit, one ref update. A few more requests, exactly one build.
- **Which made the operations atomic for free.** The old code carried a
  comment explaining that its commit order was chosen so a mid-sequence
  failure would leave an orphan post page rather than a listing entry
  pointing at a 404. That tradeoff is gone: either the whole note lands
  or none of it does, and the same guarantee covers edit and unpublish,
  which would otherwise each have needed their own careful ordering.
- **Editing needed a source of truth that didn't exist.** The repo stored
  rendered HTML and a 160-character excerpt — nothing you could load back
  into a textarea without reverse-engineering prose out of markup, which
  is not a thing to attempt. `publish.mjs` now saves each note's plain
  text verbatim to `pages/field-notes/sources/<slug>.txt`.
- **One file per note, not one shared JSON blob.** The alternative was a
  single `sources.json`. Rejected because JSON has to escape prose: every
  paragraph break becomes a literal backslash-n on one enormous line,
  unreadable in the file and worse in a diff, where a one-word fix to one
  note would show up as a single changed line containing every other
  note's text too. YAML was ruled out earlier and harder — Node has no
  YAML parser in core, so it would mean the npm dependency
  `netlify/functions/` is not allowed to have. The `.txt` mirrors
  `posts/<slug>.html`: for any slug, a page and the words it was made
  from.

- **The three notes that predate `sources/` were backfilled by hand.**
  Reconstructed from their rendered pages, which was only safe because
  all three are short and their bodies are plain paragraphs and bare
  links. The admin form handles the general case instead of assuming it:
  a note with no readable source loads an empty box _and_ an error line
  saying anything typed there replaces the whole post, rather than
  silently offering a blank textarea that would erase it on save.
- **An edit is not a republish.** The slug and the original date are
  never touched, and the manifest entry is rewritten in place rather than
  moved — so a published URL keeps working and revising an old note
  doesn't bump it to the top of the listing. `applyEdit` is a pure
  function specifically so that promise is unit-tested rather than
  asserted in a comment.
- **`publish.mjs` became the shared module.** `edit.mjs` and
  `unpublish.mjs` import its renderers and its GitHub plumbing rather
  than keeping copies, so all three endpoints emit byte-identical listing
  and feed markup and can't drift. Netlify treats each top-level file in
  `netlify/functions/` as its own function; a relative import between two
  of them is just a normal import that the bundler inlines.
- **The slug is validated against the shape `slugify()` produces**
  (`/^[a-z0-9]+(-[a-z0-9]+)*$/`) before it's interpolated into a repo
  path, on both new endpoints. It's the site owner's own form, but a slug
  goes straight into a file path and there's no reason to let one contain
  a dot or a slash.
- **Deleting a file that isn't there is asked about first.** The tree API
  rejects a delete for a path it can't find, so `unpublish.mjs` checks
  whether the page and source exist and skips the entries that don't —
  which means a manifest entry whose files were already removed by hand
  still cleans up instead of erroring forever.
- **Rust stayed off the delete button's label.** `--rust` is 4.47:1 on
  `--paper` and still open above; the destructive button takes it as a
  border color only and keeps `--ink` for its text. Same split-token
  discipline as `--phosphor-dim`/`--phosphor-line`.
- **Verified against a fake GitHub API, not just unit tests.** All three
  handlers were run end-to-end with `fetch` stubbed — 45 assertions
  covering the happy paths, that each action produces _exactly one_
  commit, that unpublishing `mt-joy-2` doesn't touch `mt-joy`, that an
  edit preserves the date and manifest position, that a traversal-shaped
  slug is refused, and that unpublishing the last note leaves a valid
  empty listing and feed. The unit tests (`edit.test.mjs`,
  `unpublish.test.mjs`) cover the pure helpers; run everything with
  `node --test "tests/*.test.mjs"`.

Open items: same as the original publish flow — none of this is verified
against a live Netlify site + real GitHub token, because the repo still
isn't connected. The stubbed run covers the request/response shapes the
GitHub API documents, not GitHub's actual behavior.

## Netlify: cutting the build count

Build capacity, not disk or bandwidth, is the budget on this site. The
work above took a publish from four commits to one; this is the rest of
it, and most of the saving turned out not to be in publishing at all.

- **Deploy previews were the bigger leak.** `CLAUDE.md` mandates
  branch-per-change and PRs, and Netlify builds every push to an open PR
  by default. A few commits on a working branch outnumber a month of
  publishing. `netlify/should-deploy.mjs` cancels any build whose
  `CONTEXT` isn't `production`, and the dashboard setting (Site
  configuration → Build & deploy → Branches and deploy contexts) should be
  turned off too — the script is the backstop, not the fix.
- **Docs commits were deploying a byte-identical site.** `c5e604e` is the
  clearest case: a one-file README change that ran a full production
  deploy. The guard now skips production commits that touch only `*.md`,
  `tests/`, `.github/`, `.claude/`, or formatter config.
- **The ignore list is a denylist, deliberately.** Anything not explicitly
  named as developer-facing counts as site-affecting, so a new top-level
  directory deploys by default rather than being silently dropped. The
  opposite arrangement fails quietly and late.
- **Netlify reads the exit code backwards.** `0` cancels the build,
  non-zero proceeds. Worth stating loudly because it reads like a bug on
  every future encounter, and inverting it by accident would mean either
  never deploying or never skipping.
- **Fails safe in every direction.** No `CACHED_COMMIT_REF`, a cached
  commit missing from Netlify's shallow clone, an unreadable `COMMIT_REF`,
  git erroring for any reason — all deploy. A wasted build costs a few
  seconds of capacity; silently not shipping a post is something you'd
  discover days later from a reader, if at all.
- **Tested as a subprocess, not as a pure helper.** All the risk in that
  script is in the env-var and git handling, so its test file builds a
  throwaway git repo in a temp dir, commits a docs-only change, a post, a
  mixed commit, a function change and a `netlify.toml`
  change, and runs the real script against each. Pinned to a scratch repo
  rather than this one's history on purpose: CI checks out shallow, so a
  test anchored to real commits would pass locally and fail there. 13
  cases, including all four fail-safe paths.
- **The mixed commit is the case that matters.** One served file among
  ignored ones must still deploy. Getting that backwards is the failure
  mode where publishing appears to work and silently stops.

Still on the table, not done: batching several publishes into one deploy
(a draft queue flushed on a schedule), and moving content out of git so
publishing never rebuilds at all. Both are real reductions; both cost
something this site currently values, so they're a deliberate decision
rather than a cleanup.

## Field notes: serving from git so publishing never deploys

The build-count work above was optimisation. This isn't: Netlify build
capacity ran out mid-month, which on a static site means the blog simply
cannot publish until it resets. Trimming builds doesn't help when the
budget is zero. The fix is for publishing not to need a build at all.

- **What actually changed is who hands a file to the reader.** Not how
  notes are made -- `publish.mjs` still commits real, final HTML to
  `main`, byte for byte as before. Previously the CDN served that file,
  having received it at build time, so a note wasn't live until the site
  rebuilt. `netlify/functions/notes.mjs` now fetches the committed file
  from GitHub per request. Live in ~30 seconds, zero builds.
- **The static files stay, and that's the point.** They keep `git clone`
  and open working, keep CI's link checker meaningful, and make the whole
  thing reversible: delete the function and the five redirects and the
  site falls back to build-time serving with no migration and no data to
  move. Every other option considered -- Netlify Blobs, an external CMS,
  a database -- would have made the repo stop being the source of truth.
  This one adds a serving path on top of files that are still just files.
- **`force = true` on the rewrites is load-bearing.** Without it Netlify
  serves the copy baked into the last build, which is precisely the stale
  file this exists to route around. Easy to lose in a future edit and it
  would fail quietly: the site would look fine and just stop updating.
- **`field-notes.css` is deliberately left on the build path.** It's
  hand-owned, only changes when someone edits it, and leaving it static
  saves a function invocation on every single pageview. It's therefore
  absent from both the redirect list and the build-guard ignore list --
  the one file in that folder that still costs a deploy to change.
- **`resolveFile` is a security boundary, not a router.** The function
  holds a token that can read the entire private repo. It serves a strict
  allowlist and rebuilds the repo path out of validated pieces rather
  than passing any request input through, so traversal, encoded
  traversal, a wrong extension, or a slug that isn't slugify-shaped all
  resolve to nothing. Tested by its refusals more than its successes,
  including that a refused path never reaches GitHub at all.
- **Conditional requests are forwarded, not answered locally.** A
  reader's `If-None-Match` goes to GitHub, which replies 304 for an
  unchanged file -- and a 304 doesn't count against the API rate limit.
  The cheap path stays cheap the whole way down. Combined with a
  30-second CDN cache, a busy day is nowhere near the 5,000/hour ceiling.
- **The build guard had to be updated in step, and its tests inverted.**
  `pages/field-notes/{posts,sources}/`, `posts.json`, `feed.xml` and
  `field-notes.html` are now in the ignore list, so a publish commit
  skips the build. Two tests that previously asserted "a published post
  deploys" now assert the opposite; if they ever flip back, publishing is
  billable again and the decoupling is broken.
- **Verified against a stubbed GitHub, 27 checks.** Content types per
  extension, cache headers, ETag pass-through, 304 handling, 404 for a
  missing note, 502 for a network failure or a GitHub 5xx, 500 for a
  missing token, and every refusal path. Plus 16 unit tests on the pure
  helpers.

The honest gap: **none of the Netlify routing can be tested without
deploying.** Whether a v2 function's `config.path` beats a static file,
and exactly which shape a rewritten request arrives in, are both things
the docs describe and I could not exercise. `requestedPath` therefore
takes whichever signal is actually present -- the explicit `?file=` from
the redirect, then Netlify's original-path header, then the request URL --
rather than betting on one. First real deploy is the test.

Also worth recording: activating any of this needs one deploy, which is
the thing there's no capacity for. `npx netlify-cli deploy --prod --dir=.`
uploads a prebuilt directory instead of running a build in Netlify's CI,
and there's no build step here to skip -- worth confirming against the
plan's own metering before relying on it.

## Field notes rebuilt on Astro + Supabase

The two previous entries describe an approach that did not work. Recording
why, because the failure was informative and the replacement is shaped by
it.

**What actually broke.** Serving notes from git at request time relied on
intercepting `/pages/field-notes/*` with a forced Netlify rewrite to a
function. Deployed, those paths returned Netlify's own 404 page: the
request never reached the function at all. The functions themselves were
live and healthy the whole time (`/api/edit` and `/api/unpublish` both
answered 405 to a GET), so the fault was purely in the routing trick. That
trick was the one part of the design that could not be tested without
deploying, and it was the one part that was wrong.

**The lesson worth keeping.** 73 unit tests passed against an
implementation that had never served a single page. Coverage of pure
functions said nothing about whether the thing worked. Everything below is
arranged so that cannot happen again.

- **Content moved out of git entirely.** Notes are rows in Supabase,
  rendered on request by Astro. Publishing touches no file, produces no
  commit, and triggers no build -- which was the actual requirement all
  along, and which no amount of cleverness with static files was going to
  satisfy while Netlify build capacity was exhausted.
- **Row-level security is the boundary, not the app.** There is no
  service-role key in the codebase. Reads use the anon key and see only
  published notes; writes run as the signed-in admin's own session. The
  `currentAdmin()` check in the API routes exists to return a clean 401 --
  if it were deleted tomorrow, the database would still refuse the write.
- **Signed in is not authorised.** Write policies require membership of an
  `admins` table. The integration test signs in as a real, valid, non-admin
  user and asserts it cannot publish and is served no admin UI. That test
  found a genuine gap in the _test double_ -- the first version handed
  every user the same access token, which would have made a real
  authorisation bug invisible.
- **The shared secret is gone.** It is now Supabase Auth: a hashed
  password, a session in an httpOnly cookie that page scripts cannot read,
  and a token verified with Supabase on every request rather than trusted
  from the cookie. `sameSite=lax` is what stands in for CSRF tokens on the
  JSON endpoints.
- **Unpublishing stopped being destructive.** It sets `status = 'draft'`.
  The old implementation deleted files and offered git history as the undo,
  which is not an undo anybody would actually use.
- **The renderer survived unchanged.** `src/lib/render.mjs` is the same
  plain-text-to-HTML code, with the same tests, that the static version
  used. Paragraph handling, escaping, inline linkification and preview
  cards all behave identically -- the move changed where notes are stored,
  not how they read.
- **Legacy URLs redirect permanently.** An old post URL sends a 301 to its
  `/field-notes/<slug>` equivalent, and the old listing URL likewise. Slugs and publication dates were carried over verbatim in
  `supabase/seed.sql`, including the recovered link preview cards, so no
  previously published URL is dead.

**What is now actually verified.** A fake Supabase (in `tests/`) speaks
enough GoTrue and PostgREST to run the real application: sign
in, publish, read the rendered HTML back, edit, unpublish, confirm the page
404s and the listing and feed drop it, republish, sign out. It enforces the
RLS rules the app depends on, so an authorisation regression fails a test
rather than passing quietly. Roughly 60 assertions, plus 43 unit tests, and
CI now runs all of it -- plus the build, plus a check that the SSR function
was actually emitted.

Two assertions in that suite were wrong on the first pass and worth noting,
because both were _my_ error rather than the app's. A naive
`html.includes("<script>...")` check flagged markup sitting inside a quoted
attribute value, where `<` is inert text and nothing can execute; and an
`onerror=alert` substring check flagged correctly-escaped text in a
`<title>`. Both were replaced with checks on the property that matters --
no script or img element in the rendered body, no attribute breakout.

**The cost, stated plainly.** There is now a build step, a `package.json`,
and 744 packages in `node_modules`, ten of which carry high-severity
advisories via `@astrojs/netlify`'s local-dev tooling (sharp, ipx,
extract-zip). They are dev-time rather than in the deployed function, and
`npm audit fix` cannot resolve them without breaking changes. This is the
price of the framework and it should be re-checked periodically rather than
forgotten. `public/` keeps the hand-written pages exactly as they were --
still real HTML, still openable from disk, still shipping no framework to a
reader.

Open items: the Supabase project itself has to be created and seeded before
any of this runs, and none of it has been exercised against a real Supabase
instance -- only against the fake. The first real sign-in is the test.

## New piece: "the wire"

Added 2026-08-27 as entry `04` in the index: `public/pages/wire/`, plus
`src/lib/feed.mjs` and `src/pages/api/feed.js`. Fills the `entry--placeholder`
slot that was reserved for "whatever gets built next." An RSS/Atom
aggregator styled as a teletype/ticker -- splice in a feed, watch the
headlines print past. Two decisions were locked before any code was
written: the tactile metaphor is teletype/ticker, not a dial or a
card-flip, and subscriptions live client-side only, in `localStorage` --
no database, no accounts, no cross-device sync. That second choice is
what keeps this a toy in the same register as starfield and the character
generator, rather than a second CMS-shaped build.

Fetching arbitrary third-party feed XML from a browser hits CORS on most
real feeds, so `src/pages/api/feed.js` exists as a small stateless proxy
-- the one route in `src/pages/api/` with no auth, no cookies, and no
Supabase, because it reads no database and writes nothing. It reuses
`RenderError`, `isFetchableUrl`, and `makeExcerpt` straight from
`render.mjs` rather than redefining them, and duplicates the two helpers
that are module-private there (`decodeHtmlEntities`, a capped-body-read)
-- the same "small helper, small duplication" call already made for the
per-route `json()` responses across this codebase.

Deliberate choices worth remembering:

- **Regex, not a real XML parser**, in `src/lib/feed.mjs` -- the second
  precedent, after `render.mjs`'s `parseOgTags`, for hand-rolling markup
  extraction rather than adding an npm dependency for the one part of the
  site that isn't supposed to need one. It handles both RSS 2.0 and Atom,
  including Atom's attribute-based `<link href="...">` (RSS's is a plain
  text node) and its multiple, differently-`rel`'d `<link>` elements. RSS
  1.0/RDF is detected and explicitly refused rather than silently
  returning nothing -- real feeds are overwhelmingly one of the other two.
- **Entities decode before tags strip, not after.** The first version had
  this backwards and it went unnoticed by every test, because the test
  fixtures happened to use literal `<b>` rather than the entity-escaped
  `&lt;b&gt;` real feeds actually send. Caught only by fetching a real
  feed by hand during verification, which is exactly why that step
  wasn't skipped even though the unit tests were green.
- **Numeric HTML entities, not just the five named ones.** A live NASA
  feed surfaced `&#8217;` (a right single quote) rendering as literal
  text mid-sentence -- `render.mjs`'s `parseOgTags` never needed numeric
  refs because OG tags rarely carry them, but RSS/Atom feeds lean on them
  constantly for smart quotes and dashes. Added `&#NNN;`/`&#xHHH;`
  decoding via `String.fromCodePoint` and a regression test built from
  the actual failing case.
- **`fetchFeed` throws on failure; `fetchLinkPreview` returns null on
  failure.** Same shape, opposite failure behaviour, and both are
  correct for what calls them: a broken link preview silently degrades
  to a plain link inside a note nobody else depends on, but the wire's
  UI needs to know _which_ subscribed feed broke so it can show that
  feed's own "no signal" state without discarding the others.
- **`public/pages/wire/` is the first use of `localStorage` anywhere on
  this site.** Starfield keeps everything in memory; the character
  generator deliberately uses URL-hash state instead, on purpose, so a
  link reproduces an exact character. Neither precedent fit a feed list
  meant to survive a reload with no link to carry it. Schema is two
  keys: `static:wire:feeds` (the subscription list -- url, cached title,
  last-fetch time, last error; fetched _items_ are never persisted, only
  ever live) and `static:wire:tempo` (the chosen scroll speed). Every
  read and write is wrapped in try/catch, since private browsing and
  storage-disabled Safari can throw on `setItem` -- degrades to
  in-memory-only for the session rather than crashing the page.
- **The stop key is unconditional, not a reduced-motion fallback.**
  WCAG 2.2.2 (Pause, Stop, Hide) applies to any auto-updating content
  running past five seconds in parallel with other content, independent
  of a user's motion preference -- a continuously looping ticker needs a
  reachable stop control regardless of whether reduced motion is set.
  Reduced motion goes further, following the character generator's
  transport precedent: the run key is disabled and relabelled ("off --
  reduced motion") rather than merely slowed. The plain, fully readable
  headline list beneath the tape is not a fallback shown only when the
  tape can't run -- it renders unconditionally, always, and is the
  actual reading surface; the tape is the tactile layer on top of it.
- **The tape is a JS-driven transform, not a CSS animation**, specifically
  so the stop key can freeze it exactly in place. A running `@keyframes`
  animation paused mid-cycle is awkward to resume seamlessly and easy to
  get subtly wrong; a `requestAnimationFrame` loop that simply stops
  writing new `transform` values freezes cleanly by construction, which
  was confirmed in verification by sampling the transform value across a
  stop.
- **A per-feed status, not an all-or-nothing one.** A broken feed shows
  "no signal" in its own row and is retried on the next refresh; it
  never removes itself and never blocks the other subscribed feeds from
  rendering -- the same graceful-degradation philosophy as field notes'
  link-preview fallback cards.
- **No server-side caching of feed results.** Every refresh -- manual or
  automatic -- is a live round trip through `/api/feed` to the original
  server. The only thing bounding that is a 10-minute auto-refresh
  interval, gated by `document.visibilityState` so a backgrounded tab
  stops polling entirely rather than hammering someone else's server
  unattended, catching up immediately on return.
- **Limits, and why:** 25 items per feed and a 1.5MB capped read (both
  larger than `render.mjs`'s 300KB OG-scraping cap, since a full feed
  with descriptions legitimately runs bigger than one page's `<head>`),
  an 8-second fetch timeout (feed servers run slower than the sites
  `fetchLinkPreview` targets), and a soft cap of 20 subscribed feeds so
  a refresh never fires more than 20 parallel requests -- the same
  bounded-parallelism reasoning as `MAX_LINK_PREVIEWS = 5`.
- **Verified against real, live feeds, not only fixtures** -- Hacker
  News, BBC News, NASA, and GitHub's Atom releases/commits feeds, plus
  the SSRF guard confirmed against `localhost` and a nonexistent domain,
  all exercised through `astro dev` directly. This route needs neither
  Supabase nor Netlify to run for real (no auth, no database), so
  materially more of this feature was checkable locally than any part of
  the field-notes rebuild above ever was.

Explicitly out of scope: OPML import/export, RSS 1.0/RDF, any audio or
sound-effect layer, and cross-device sync -- all deferred, none accidental.

Open items: real-world feed diversity beyond what was hand-tested here
(unusual encodings, more exotic malformed XML, hosts that block an honest
bot `User-Agent`) will surface parser gaps the way the entity-decoding and
numeric-entity bugs did -- expected, and the reason `feed.mjs` stayed a
small, easily-patched module rather than something more clever.

## Supabase database advisors (2026-08-27) — five fixed in SQL, one isn't SQL

The security advisors flagged four things and the performance advisors two
more. `supabase/schema.sql` now answers five of the six; re-run it in the
SQL editor to apply.

- **`function_search_path_mutable` on `public.touch_updated_at`** — fixed.
  The trigger now pins `set search_path = ''`. It touches no objects, so
  an empty path costs it nothing and removes the shadowing-schema risk.
- **`anon`/`authenticated` can execute a `SECURITY DEFINER` function** —
  fixed by moving, not by revoking. `is_admin()` now lives in a `private`
  schema, which PostgREST does not expose, so there is no
  `/rest/v1/rpc/is_admin` any more. Revoking `EXECUTE` in `public` was the
  wrong fix: the RLS policies call it as the invoking role, so revoking
  would have locked admins out of their own drafts. `EXECUTE` is granted
  to `authenticated` only, and its `search_path` is pinned empty too (the
  body already schema-qualifies `public.admins` and `auth.uid()`).
- **Leaked password protection disabled** — still open, and not fixable
  here: it's a project setting, not schema. Dashboard -> Authentication ->
  Password protection -> enable "Prevent use of leaked passwords". Noted
  in `schema.sql`'s setup comments alongside the "turn signups off" step,
  which is the same kind of instruction.

Re-running `schema.sql` against the live database is safe: the policies are
dropped and recreated before the old `public.is_admin()` is dropped, so
nothing references it at the moment it goes.

The two performance advisors are answered in the same pass:

- **`auth_rls_initplan` on `public.admins`** — the policy called a bare
  `auth.uid()`, which Postgres re-evaluates once per row. Wrapped as
  `(select auth.uid())` it is hoisted to an InitPlan and runs once per
  query. The same wrapping is applied to every `private.is_admin()` call
  in the notes policies. The linter doesn't flag those (it only looks for
  `auth.*` and `current_setting`), but the mechanism is identical and the
  notes table is the one that actually gets scanned.
- **`multiple_permissive_policies` on `public.notes`** — an authenticated
  `SELECT` matched three permissive policies, all of which Postgres OR-s
  and evaluates on every row: the world-readable one, `admins read every
note`, and `admins write notes`, which was `for all` and so counted as a
  SELECT policy too. There is now exactly one policy per role per action:
  one SELECT for `anon`, one SELECT for `authenticated` carrying both
  halves of the rule (`status = 'published' or (select
private.is_admin())`), and separate INSERT/UPDATE/DELETE policies for
  admins. `admins read every note` turned out to be entirely redundant
  with the `for all` policy that already granted admins read access.

None of this changes who can see or do what. That was checked rather than
assumed: `schema.sql` was applied to a throwaway Postgres 16 in Docker,
with small stand-ins for `auth.users`, `auth.uid()` and the `anon` /
`authenticated` roles, and the resulting policies exercised directly --
anon sees one note, a signed-in non-admin sees the same one, an admin sees
both, a non-admin's insert is refused by RLS and its update matches zero
rows, an admin's insert and update succeed, a non-admin sees no rows in
`admins`, `public.is_admin` no longer exists, and `pg_policies` shows one
policy per role/action. `explain` confirms the InitPlan. The file also
applies cleanly a second time over its own output.

The unit and integration suites do not cover any of this: `fake-supabase`
reimplements the RLS rules in JavaScript rather than running the SQL, so
it will happily keep passing whatever `schema.sql` says. Worth remembering
before trusting a green CI on a schema change.

## Found while building the pinboard (2026-08-27)

**`--rust` on `--paper` was under AA for small text — FIXED.**
Lighthouse independently caught it on the wire's back-link (4.46:1
measured against the 4.5 threshold, at 12.8px). `--rust` is now `#ad4218`
rather than `#b8461a`: 4.92:1 on `--paper` and 5.63:1 on `--card`, with
margin rather than by a hair. The token was darkened rather than split,
because nothing wanted the lighter value for its own sake — it is text,
two borders and two dots, and all five are happier darker. The pinboard's
“tidy the board” button keeps its `--ink` label anyway; it reads better
against the card than an accent colour does.

The original note, for context: It affects `.back-link a` and the RSS link on every field
notes page, and it predates the pinboard — the board just made it visible
by needing another control. The pinboard’s “tidy the board” button dodges
it by setting its label in `--ink` and leaving `--rust` on the border,
which is the same text/border token split that keeps `--phosphor-dim`
apart from `--phosphor-line`. The real fix is either a darker rust for
text or an accepted second token; both are a site-wide change and neither
belongs in a presentation branch.

**Astro leaves `<` unescaped inside attribute values.** It escapes `"`
and `&`, so nothing breaks out of the attribute, but a note titled
`<img src=x ...>` repeated into a `data-` attribute puts a literal `<img`
into the page. That is inert, and it still trips the integration suite’s
“no `<img>` anywhere in the listing” assertion, which guards the rule that
a reader’s pageview fetches nothing from anyone else’s server. The
pinboard reads the title out of the rendered card instead of repeating
it. Not a vulnerability; worth knowing before putting note text in an
attribute again.
