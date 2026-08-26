# STATIC

A personal, hand-built corner of the internet: a small collection of
interactive pages (art, writing, whatever else) linked from one home
page, with no framework, no build step, and no algorithm.

## Structure

```
.
├── index.html          # home page — the "directory listing" of everything else
├── css/
│   └── style.css       # shared design tokens + layout (paper/ink + phosphor mode)
├── js/
│   └── main.js         # home page behavior (static-strip effect, phosphor toggle)
├── pages/
│   ├── starfield/
│   │   ├── starfield.html            # interactive piece: "a slow drift"
│   │   └── starfield.js
│   └── character-generator/
│       ├── character-generator.html         # interactive piece: "cg–20"
│       ├── character-generator.css          # page-local palette + panel/sheet layout
│       ├── character-generator-data.js      # SRD 5.2.1 tables + settings/cartridges
│       ├── settings/                        # one file per setting, self-registering
│       │   ├── generic.js                   # (see the comment in character-generator-data.js)
│       │   ├── forgotten-realms.js
│       │   ├── greyhawk.js
│       │   ├── dark-sun.js
│       │   └── dragonlance.js
│       ├── character-generator-engine.js    # seeded randomness + buildCharacter()
│       ├── character-generator-export.js    # plain text / PDF / JSON export
│       └── character-generator.js           # rendering, state, serial, UI wiring
│   ├── field-notes/
│   │   ├── field-notes.html    # generated listing — do not hand-edit
│   │   ├── field-notes.css     # hand-owned styling, never touched by publish.mjs
│   │   ├── posts.json          # generated manifest — do not hand-edit
│   │   ├── feed.xml            # generated RSS 2.0 feed — do not hand-edit
│   │   └── posts/*.html        # generated post pages — do not hand-edit
│   └── admin/
│       └── admin.html  # unlinked publish form — posts to /api/publish
├── netlify/
│   └── functions/
│       ├── publish.mjs         # the one backend piece — see CLAUDE.md
│       └── publish.test.mjs    # zero-dep unit tests, `node --test`
├── netlify.toml         # publish dir, functions dir, feed.xml content-type
├── .prettierrc.json     # formatting rules
├── .prettierignore      # exempts the two publish-generated HTML shapes
└── README.md
```

## Adding a new page

1. Create `pages/your-page/your-page.html` (copy `starfield/` as a
   starting point if it's interactive, or just write plain HTML for a
   blog post). A page with only one file can skip the subfolder.
2. Link to `../../css/style.css` for the shared look, or write scoped
   `<style>` for anything page-specific. A piece big enough to need it
   can bring its own stylesheet next to it (see `character-generator.css`).
3. Add an `<li class="entry">` to the list in `index.html` pointing at
   it, and remove the `entry--placeholder` class once it's real.
4. Format before committing:
   ```
   npx prettier@3.9.6 --write "**/*.{html,css,js,json,md}"
   ```
   CI runs the same command with `--check`, pinned to the same version,
   so running this is always enough to make it pass.

## Local preview

No build step — just open `index.html` in a browser, or serve the
folder locally:

```
npx serve .
```

## Deploying

Pick one (both are free for a static site like this):

- **GitHub Pages** — push this folder to a GitHub repo, then enable
  Pages in the repo settings (Settings → Pages → deploy from branch).
  Serves every page fine, but GitHub Pages can't run serverless
  functions, so **field notes publishing won't work** — you'd be back to
  hand-writing and committing post files yourself.
- **Netlify** — connect the repo at netlify.com. Required if you want
  live publishing, since `netlify/functions/publish.mjs` needs it.
  `netlify.toml` already declares the publish directory and functions
  directory, so connecting the repo is enough — no other Netlify config
  to write.

### Publishing setup (Netlify only)

Set these as environment variables on the Netlify site (Site settings →
Environment variables) before using `pages/admin/admin.html`:

- `PUBLISH_SECRET` — a long, random string. Typed into the admin page's
  password field on each publish; never stored in the browser.
- `GITHUB_TOKEN` — a GitHub fine-grained personal access token, scoped to
  **just this repo**, with Contents: Read and write permission.
- `GITHUB_REPOSITORY` — `owner/repo`, e.g. `VacantFanatic/fantastic-chainsaw`.

`URL` (the site's own address, used for absolute RSS links) is injected
automatically by Netlify — nothing to set.

## Domain

Buy a domain (Cloudflare Registrar or Namecheap are both
straightforward, at-cost options), then point it at whichever host you
chose:

- GitHub Pages: add a `CNAME` file with your domain, and set the DNS
  A/ALIAS records per GitHub's Pages docs.
- Netlify: add the domain in the site's Domain settings; Netlify walks
  you through the DNS records.

## Design notes

- Palette: warm paper (`--paper`) and ink (`--ink`) by default, with a
  rust accent and a muted mint hover state. A "phosphor mode" toggle
  flips the whole page to a green-on-black terminal look.
- Type: `Space Mono` for structure (headers, labels, nav) paired with
  `Lora` for anything meant to be read at length.
- The static-strip canvas at the top of the home page and the
  cursor-reactive starfield are the two signature touches — deliberately
  kept to those two spots rather than scattered everywhere.
