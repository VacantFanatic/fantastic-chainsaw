# STATIC

A personal, hand-built corner of the internet: a small collection of
interactive pages (art, writing, whatever else) linked from one home
page, with no framework, no build step, and no algorithm.

## Structure

```
site/
├── index.html          # home page — the "directory listing" of everything else
├── css/
│   └── style.css       # shared design tokens + layout (paper/ink + phosphor mode)
├── js/
│   └── main.js         # home page behavior (static-strip effect, phosphor toggle)
├── pages/
│   ├── starfield.html  # interactive piece: "a slow drift"
│   ├── starfield.js
│   ├── character-generator.html   # interactive piece: "cg–20"
│   ├── character-generator.css    # page-local palette + panel/sheet layout
│   └── character-generator.js     # SRD 5.2.1 data + seeded generator
├── .prettierrc.json    # formatting rules
└── README.md
```

## Adding a new page

1. Create `pages/your-page.html` (copy `starfield.html` as a starting
   point if it's interactive, or just write plain HTML for a blog post).
2. Link to `../css/style.css` for the shared look, or write scoped
   `<style>` for anything page-specific. A piece big enough to need it
   can bring its own stylesheet next to it (see `character-generator.css`).
3. Add an `<li class="entry">` to the list in `index.html` pointing at
   it, and remove the `entry--placeholder` class once it's real.
4. Format before committing:
   ```
   npx prettier --write "**/*.{html,css,js}"
   ```

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
- **Netlify** — connect the repo at netlify.com, or drag-and-drop the
  `site/` folder onto their dashboard for an instant deploy.

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
