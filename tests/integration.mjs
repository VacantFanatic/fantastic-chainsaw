// End-to-end check: the real Astro server, the real auth handling, the
// real rendering -- against tests/fake-supabase.mjs instead of a live
// project. Nothing here is mocked inside the application.
//
// Not named *.test.mjs on purpose: it needs a dev server running, so it's
// a deliberate command rather than part of `npm test`.
//
//   Terminal 1:  npm run dev
//   Terminal 2:  node tests/integration.mjs
//
// It asserts the things that actually went wrong last time -- that a page
// renders, that a signed-out caller is refused, that an unpublished note
// really disappears -- rather than that a function returns the right shape.

import { startFakeSupabase } from "./fake-supabase.mjs";

const SITE = process.env.SITE ?? "http://localhost:4321";
const ADMIN = {
  email: "owner@example.com",
  password: "correct-horse",
  isAdmin: true,
};
const INTRUDER = {
  email: "someone@example.com",
  password: "hunter2",
  isAdmin: false,
};

let failures = 0;
const check = (label, actual, expected) => {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    `${pass ? "ok  " : "FAIL"}  ${label}`,
    pass
      ? ""
      : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`,
  );
  if (!pass) failures += 1;
};
const truthy = (label, value) => check(label, Boolean(value), true);

// Minimal cookie jar: Node's fetch doesn't keep cookies between calls, and
// the whole point here is that the session cookie does its job.
function jar() {
  const store = new Map();
  return {
    header: () => [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        const name = pair.slice(0, idx).trim();
        const value = pair.slice(idx + 1).trim();
        if (value === "") store.delete(name);
        else store.set(name, value);
      }
      return res;
    },
    has: (prefix) => [...store.keys()].some((k) => k.startsWith(prefix)),
    clear: () => store.clear(),
  };
}

async function req(cookies, method, path, body) {
  const res = await fetch(`${SITE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookies.header() ? { Cookie: cookies.header() } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  cookies.absorb(res);
  return res;
}

const fake = await startFakeSupabase({ users: [ADMIN, INTRUDER] });
console.log(`fake supabase on ${fake.url}\n`);

try {
  const anon = jar();

  /* ------------------------------------------------- before anything */

  let res = await req(anon, "GET", "/field-notes");
  let html = await res.text();
  check("empty listing renders", res.status, 200);
  truthy("  ...and says so", html.includes("nothing published yet."));

  res = await req(anon, "GET", "/admin");
  html = await res.text();
  check("admin renders for a stranger", res.status, 200);
  truthy("  ...showing a login form", html.includes('id="login-form"'));
  check(
    "  ...and NO publish form in the HTML",
    html.includes("publish-form"),
    false,
  );
  check("  ...and no note bodies leaked", html.includes("initialNotes"), false);

  /* -------------------------------------------------------- refusals */

  res = await req(anon, "POST", "/api/notes", { title: "Sneaky", body: "x" });
  check("publishing while signed out is refused", res.status, 401);
  check("  ...nothing was written", fake.state.notes.length, 0);

  res = await req(anon, "POST", "/api/auth", {
    email: ADMIN.email,
    password: "wrong-password",
  });
  check("wrong password is refused", res.status, 401);
  check(
    "  ...with a vague message",
    (await res.json()).error,
    "invalid_credentials",
  );
  check("  ...and sets no session cookie", anon.has("sb-"), false);

  // A real, valid account that simply isn't an admin.
  const intruder = jar();
  res = await req(intruder, "POST", "/api/auth", {
    email: INTRUDER.email,
    password: INTRUDER.password,
  });
  check("a non-admin CAN sign in", res.status, 200);
  res = await req(intruder, "POST", "/api/notes", { title: "Nope", body: "x" });
  check("  ...but cannot publish", res.status, 401);
  res = await req(intruder, "GET", "/admin");
  check(
    "  ...and gets no desk UI",
    (await res.text()).includes("publish-form"),
    false,
  );

  /* ----------------------------------------------------------- login */

  const admin = jar();
  res = await req(admin, "POST", "/api/auth", {
    email: ADMIN.email,
    password: ADMIN.password,
  });
  check("admin signs in", res.status, 200);
  truthy("  ...gets a session cookie", admin.has("sb-"));

  const setCookie = res.headers.getSetCookie?.().join(" ") ?? "";
  truthy("  ...marked HttpOnly", /HttpOnly/i.test(setCookie));
  truthy("  ...marked SameSite=Lax", /SameSite=Lax/i.test(setCookie));

  res = await req(admin, "GET", "/admin");
  html = await res.text();
  truthy("desk UI appears once signed in", html.includes('id="publish-form"'));
  truthy("  ...naming the signed-in user", html.includes(ADMIN.email));

  /* --------------------------------------------------------- publish */

  res = await req(admin, "POST", "/api/notes", {
    title: "Hell Yeah Brother!",
    body: "Dark Sun is back.\n\nSecond paragraph with <script>alert(1)</script>.",
  });
  const published = (await res.json()).note;
  check("publish succeeds", res.status, 200);
  check("  ...slugified", published.slug, "hell-yeah-brother");
  check(
    "  ...excerpt derived",
    published.excerpt.startsWith("Dark Sun is back."),
    true,
  );

  res = await req(anon, "GET", "/field-notes");
  html = await res.text();
  truthy(
    "note appears in the listing immediately",
    html.includes("Hell Yeah Brother!"),
  );
  truthy(
    "  ...linking to the clean URL",
    html.includes('href="/field-notes/hell-yeah-brother"'),
  );

  res = await req(anon, "GET", "/field-notes/hell-yeah-brother");
  html = await res.text();
  check("the note page renders", res.status, 200);
  truthy("  ...with the body", html.includes("Dark Sun is back."));

  // The property worth asserting isn't "this string never appears" --
  // inside a quoted attribute value `<` is inert text, so a naive
  // substring check fails on markup that can never execute. What matters
  // is that nothing hostile survives into a position a browser would run.
  const noteBody = html.slice(
    html.indexOf('<div class="note__body">'),
    html.indexOf("</main>"),
  );
  truthy(
    "  ...body escaped",
    noteBody.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
  );
  check("  ...no script element in the body", /<script/i.test(noteBody), false);

  res = await req(anon, "GET", "/field-notes/feed.xml");
  const feed = await res.text();
  check("feed renders", res.status, 200);
  truthy("  ...containing the note", feed.includes("Hell Yeah Brother!"));
  truthy(
    "  ...with an absolute link",
    feed.includes("/field-notes/hell-yeah-brother"),
  );

  /* -------------------------------------------------- hostile input */

  // A title is the more interesting target than a body: it lands in a
  // <title>, an <h1>, a meta attribute, the listing and the RSS feed, and
  // each of those escapes differently.
  res = await req(admin, "POST", "/api/notes", {
    title: 'Nasty " <img src=x onerror=alert(9)>',
    body: "Body of the nasty one.",
  });
  const nasty = (await res.json()).note;
  check("a hostile title publishes", res.status, 200);
  check(
    "  ...slug drops the markup",
    nasty.slug,
    "nasty-img-src-x-onerror-alert-9",
  );

  res = await req(anon, "GET", `/field-notes/${nasty.slug}`);
  html = await res.text();
  truthy("  ...title escaped in the page", html.includes("&lt;img src=x"));
  check("  ...no img element anywhere", /<img/i.test(html), false);
  check("  ...no quote breakout", /"\s+on\w+=/i.test(html), false);
  // Note: `onerror=alert(9)` DOES appear in the page, as escaped text
  // inside <title> and as inert text in a quoted meta attribute. That is
  // not a finding. "No img element" and "no quote breakout" above are the
  // checks that would actually catch an injection.

  res = await req(anon, "GET", "/field-notes");
  check(
    "  ...and escaped in the listing too",
    /<img/i.test(await res.text()),
    false,
  );

  res = await req(anon, "GET", "/field-notes/feed.xml");
  const nastyFeed = await res.text();
  truthy("  ...XML-escaped in the feed", nastyFeed.includes("&lt;img src=x"));

  await req(admin, "PATCH", "/api/notes", {
    slug: nasty.slug,
    status: "draft",
  });

  /* ------------------------------------------------------------ edit */

  const before = fake.state.notes[0];
  res = await req(admin, "PUT", "/api/notes", {
    slug: "hell-yeah-brother",
    title: "Hell Yeah, Brother",
    body: "Rewritten entirely.",
  });
  const edited = (await res.json()).note;
  check("edit succeeds", res.status, 200);
  check("  ...keeps the slug", edited.slug, "hell-yeah-brother");
  check(
    "  ...keeps the original date",
    edited.published_at,
    before.published_at,
  );
  check("  ...updates the title", edited.title, "Hell Yeah, Brother");

  res = await req(anon, "GET", "/field-notes/hell-yeah-brother");
  html = await res.text();
  truthy("the edit is live", html.includes("Rewritten entirely."));
  check("  ...old text is gone", html.includes("Dark Sun is back."), false);

  /* ------------------------------------------------------- unpublish */

  res = await req(admin, "PATCH", "/api/notes", {
    slug: "hell-yeah-brother",
    status: "draft",
  });
  check("unpublish succeeds", res.status, 200);

  res = await req(anon, "GET", "/field-notes/hell-yeah-brother");
  check("the note 404s for the public", res.status, 404);

  res = await req(anon, "GET", "/field-notes");
  truthy(
    "  ...and leaves the listing",
    (await res.text()).includes("nothing published yet."),
  );

  res = await req(anon, "GET", "/field-notes/feed.xml");
  check("  ...and the feed", (await res.text()).includes("Hell Yeah"), false);

  check("  ...but the row still exists", fake.state.notes.length, 2);

  res = await req(admin, "PATCH", "/api/notes", {
    slug: "hell-yeah-brother",
    status: "published",
  });
  check("republishing brings it back", res.status, 200);
  res = await req(anon, "GET", "/field-notes/hell-yeah-brother");
  check("  ...live again", res.status, 200);

  /* ---------------------------------------------------------- logout */

  res = await req(admin, "POST", "/api/auth", { action: "logout" });
  check("logout succeeds", res.status, 200);
  res = await req(admin, "GET", "/admin");
  check(
    "  ...desk UI is gone",
    (await res.text()).includes("publish-form"),
    false,
  );

  /* --------------------------------------------------- legacy URLs */

  res = await req(anon, "GET", "/pages/field-notes/field-notes.html");
  check("legacy listing URL redirects", res.status, 301);
  check("  ...to the new one", res.headers.get("location"), "/field-notes");

  res = await req(
    anon,
    "GET",
    "/pages/field-notes/posts/hell-yeah-brother.html",
  );
  check("legacy note URL redirects", res.status, 301);
  check(
    "  ...to the new one",
    res.headers.get("location"),
    "/field-notes/hell-yeah-brother",
  );
} finally {
  await fake.close();
}

console.log(failures ? `\n${failures} CHECK(S) FAILED` : "\nall checks passed");
process.exitCode = failures ? 1 : 0;
