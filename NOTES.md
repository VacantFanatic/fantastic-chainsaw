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
