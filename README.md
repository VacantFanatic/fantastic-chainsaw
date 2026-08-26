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
│   │   ├── field-notes.css     # hand-owned styling, never touched by the functions
│   │   ├── posts.json          # generated manifest — do not hand-edit
│   │   ├── feed.xml            # generated RSS 2.0 feed — do not hand-edit
│   │   ├── posts/*.html        # generated post pages — do not hand-edit
│   │   └── sources/*.txt       # each note's plain text, saved so it can be
│   │                            # edited later — do not hand-edit
│   └── admin/
│       └── admin.html  # unlinked publish / edit / unpublish forms
├── netlify/
│   ├── functions/              # the one backend piece — see CLAUDE.md
│   │   ├── publish.mjs         # /api/publish — renderers + GitHub plumbing
│   │   ├── edit.mjs            # /api/edit — revise a note, same slug and date
│   │   ├── unpublish.mjs       # /api/unpublish — take a note back down
│   │   └── notes.mjs           # serves field notes from git, no deploy needed
│   └── should-deploy.mjs       # cancels builds that change nothing served
├── tests/
│   ├── publish.test.mjs        # zero-dep unit tests, `node --test`, kept
│   ├── edit.test.mjs           # out of netlify/functions/ so Netlify
│   ├── unpublish.test.mjs      # doesn't try to deploy them as functions
│   ├── notes.test.mjs          # what the serving function may and may not serve
│   └── should-deploy.test.mjs  # runs the build guard against a temp repo
├── netlify.toml         # publish dir, functions dir, the build-skip guard,
│                         # the field-notes rewrites, feed.xml content-type
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
  live publishing, since `netlify/functions/` needs it. `netlify.toml`
  already declares the publish directory and functions directory, so
  connecting the repo is enough — no other Netlify config to write.

### Publishing setup (Netlify only)

Set these as environment variables on the Netlify site (Site settings →
Environment variables) before using `pages/admin/admin.html`:

- `PUBLISH_SECRET` — a long, random string. Typed into the admin page's
  password field on every publish, edit and unpublish; never stored in
  the browser.
- `GITHUB_TOKEN` — a GitHub fine-grained personal access token, scoped to
  **just this repo**, with Contents: Read and write permission.
- `GITHUB_REPOSITORY` — `owner/repo`, e.g. `your-username/your-repo-name`.

`URL` (the site's own address, used for absolute RSS links) is injected
automatically by Netlify — nothing to set.

### Writing, revising, and removing notes

All three live on `pages/admin/admin.html`, which is deliberately not
linked from anywhere public:

- **Publish** — a title and plain text; a blank line starts a paragraph,
  and a link on a line by itself becomes a preview card.
- **Edit** — pick a note, and its title and original text load into the
  form. Saving re-renders the page, but the URL and the publication date
  stay put; an edit revises a note, it doesn't republish it. Notes
  written before `sources/` existed have no saved text, and the form
  says so rather than letting you blank the post by accident.
- **Unpublish** — pick a note and confirm. It's removed from the
  listing, the feed, and the site. The commit that created it is still
  in git history, so nothing is truly lost — but the live page is gone.

Each action is exactly **one commit** on `main`. That's why the functions
use the Git Data API rather than the simpler Contents API, which can only
write one file per commit.

### Publishing never triggers a deploy

Netlify build capacity is a hard budget — run out and the site can't be
deployed at all until it resets. A blog that can't publish because the
host is out of build minutes isn't much of a blog, so publishing is
deliberately kept off the deploy path entirely.

Field notes are served **from git at request time** by
`netlify/functions/notes.mjs`. Publishing commits real HTML to `main` as
it always did; the function fetches the committed file when a reader asks
for it. A note is live within about 30 seconds of the commit, and no
build runs. `netlify.toml` routes five paths to it:

| path                                         | served by                    |
| -------------------------------------------- | ---------------------------- |
| `field-notes.html`, `posts.json`, `feed.xml` | the function, from git       |
| `posts/<slug>.html`, `sources/<slug>.txt`    | the function, from git       |
| `field-notes.css`                            | the CDN, from the last build |

Responses carry a 30-second cache and pass GitHub's `ETag` through, so a
busy day doesn't become one API call per pageview.

**Deploys are for pages and functionality.** If you ever need one to make
a note appear, something has broken.

The static files stay in the repo and stay real — a clone still works
offline, CI still link-checks them, and deleting the function and its
redirects falls straight back to build-time serving with no migration.

### What still spends a build

`netlify.toml` runs `netlify/should-deploy.mjs` as its `ignore` command,
which cancels the build for:

- anything that isn't a **production** deploy — deploy previews and
  branch deploys are builds too, and branch-per-change means they add up
  fast;
- field note content, now that the function serves it;
- production commits touching only docs, `tests/`, `.github/`, formatter
  config, or `.claude/`.

Anything else deploys, and so does anything ambiguous — a missing cached
commit, a shallow clone, a git error. Failing safe means a wasted build,
never a change that silently doesn't ship.

Also turn off previews in the dashboard (Site configuration → Build &
deploy → Branches and deploy contexts → set deploy previews and branch
deploys to none). The script is a backstop; the setting stops the build
being queued in the first place.

### Deploying without spending build minutes

If you're out of build capacity and need to ship a change anyway, the
Netlify CLI can upload a prebuilt directory instead of running a build in
Netlify's CI:

```
npx netlify-cli deploy --prod --dir=.
```

There's no build step here to skip, so this uploads the same files the CI
build would have. Dev-only tooling invoked with `npx`, same standing as
Prettier — nothing gets installed into the repo.

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
