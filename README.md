# STATIC

A personal, hand-built corner of the internet: a small collection of
interactive pages (art, writing, whatever else) linked from one home page,
with no algorithm and no feed.

The hand-written pages are still hand-written pages. The blog — "field
notes" — is an Astro app backed by Supabase, so that publishing a post
never requires deploying the site.

## Structure

```
.
├── public/                 # copied into dist/ byte for byte
│   ├── index.html          # home page — the "directory listing"
│   ├── css/style.css       # shared design tokens (paper/ink + phosphor)
│   ├── js/main.js          # home page behaviour
│   └── pages/
│       ├── starfield/      # interactive piece: "a slow drift"
│       └── character-generator/   # interactive piece: "cg–20"
├── src/
│   ├── lib/
│   │   ├── render.mjs      # plain text -> HTML. Pure, unit-tested.
│   │   ├── supabase.js     # request-scoped clients; no service-role key
│   │   └── notes.js        # every read and write for notes
│   ├── layouts/Base.astro
│   ├── components/         # the two /admin scripts
│   ├── styles/             # field-notes.css, admin.css
│   └── pages/
│       ├── field-notes/    # listing, [slug], feed.xml (server-rendered)
│       ├── admin/          # sign in + publish/edit/unpublish
│       ├── api/            # auth.js, notes.js — JSON endpoints
│       └── pages/          # permanent redirects for the old URLs
├── supabase/
│   ├── schema.sql          # tables + row-level security. Run first.
│   └── seed.sql            # the three notes that predate Supabase
├── tests/
│   ├── render.test.mjs     # the renderer
│   ├── should-deploy.test.mjs   # build guard, against a temp git repo
│   ├── fake-supabase.mjs   # test double: enough GoTrue + PostgREST
│   └── integration.mjs     # the real server, end to end
├── netlify.toml
├── netlify/should-deploy.mjs
└── astro.config.mjs
```

## Setup

### 1. Supabase

Create a project at supabase.com, then in the SQL editor:

1. Run `supabase/schema.sql` — creates the tables and the row-level
   security policies.
2. Run `supabase/seed.sql` — loads the three existing notes. Optional, and
   safe to run twice.

Create your user under **Authentication → Users → Add user**, then grant it
admin rights:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'you@example.com';
```

Then turn public signups off: **Authentication → Sign In / Providers →
Email → disable "Allow new users to sign up"**.

Being a Supabase user grants nothing on its own — write access comes only
from a row in `admins` — but there is no reason to let strangers create
accounts.

### 2. Environment variables

Locally, copy `.env.example` to `.env`. On Netlify, set them under **Site
configuration → Environment variables**:

| variable                   | where it comes from                       |
| -------------------------- | ----------------------------------------- |
| `PUBLIC_SUPABASE_URL`      | Project Settings → API                    |
| `PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API (the **anon** key) |

Both are public by design. The anon key is limited by row-level security to
reading published notes; it cannot write. **Do not add a service-role key**
— nothing here uses one, and adding one would undo the security model.

`SITE_URL` is only for local runs; Netlify injects its own `URL`.

### 3. Deploy

Connect the repo at netlify.com. `netlify.toml` already declares the build
command, the publish directory and the build-skip guard, so there is
nothing else to configure.

GitHub Pages is no longer an option for the whole site — it can't run the
server-rendered field notes routes. The hand-written pages under `public/`
would still work there.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:4321. `npm run build` produces `dist/` plus the
SSR function; `npm test` runs the unit tests.

The end-to-end test needs the dev server running:

```bash
node tests/integration.mjs
```

It starts a fake Supabase, signs in, publishes, edits, unpublishes, and
reads the rendered HTML back — no account or network needed.

## Writing, revising and removing notes

Everything happens at `/admin`, which is `noindex` and not linked from
anywhere public. Sign in with the email and password you created above.

- **Publish** — a title and plain text. A blank line starts a paragraph,
  and a link on a line by itself becomes a preview card, fetched once at
  save time and stored with the note.
- **Edit** — pick a note; its title and text load into the form. The URL
  and the publication date stay put: an edit revises a note, it doesn't
  republish it.
- **Publish status** — unpublishing turns a note into a draft. It leaves
  the listing, the feed and the site, but nothing is deleted and you can
  put it back from the same form.

None of these deploy the site. A note is live the moment it's saved.

## Deploys

A deploy is for pages and functionality, never for content.
`netlify/should-deploy.mjs` runs as Netlify's `ignore` command and cancels
builds for deploy previews, branch deploys, and commits that only touch
docs, tests, CI or formatter config. Anything ambiguous deploys — failing
safe means a wasted build, never a change that silently doesn't ship.

Also worth turning previews off in the dashboard (Site configuration →
Build & deploy → Branches and deploy contexts); the script is a backstop,
the setting stops the build being queued at all.

If you are ever out of build capacity and need to ship anyway, the Netlify
CLI uploads a prebuilt directory without running a build in Netlify's CI:

```bash
npm run build && npx netlify-cli deploy --prod --dir=dist
```

## Adding a new page

A static piece needs no Astro route — drop it in `public/pages/your-page/`
and it is served at that path verbatim. Link to `/css/style.css` for the
shared look, or write scoped `<style>`. Add an `<li class="entry">` to
`public/index.html` and remove `entry--placeholder` once it's real.

Format before committing with `npm run format`; CI checks the same glob.

## Design notes

See `CLAUDE.md` for what this site is trying to be and which constraints
are deliberate, and `NOTES.md` for the running list of known issues.
