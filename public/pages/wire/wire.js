// "the wire" -- an RSS/Atom aggregator styled as a teletype/ticker.
//
// Subscriptions live in localStorage only (the first use of localStorage
// anywhere on this site -- starfield is in-memory only, the character
// generator deliberately uses URL-hash state instead). Fetched *items*
// are never persisted, only the subscription list and each feed's last
// known title/error -- every load/refresh re-fetches live via /api/feed,
// the CORS-proxy this page needs since most feed servers don't send
// headers a browser would accept for a direct fetch.
//
// Every feed-derived string (title, description, URL) is untrusted
// third-party input and is rendered with textContent throughout, never
// innerHTML.

const STORAGE_KEY_FEEDS = "static:wire:feeds";
const STORAGE_KEY_TEMPO = "static:wire:tempo";
const STORAGE_KEY_FOLD = "static:wire:sources-open";
const MAX_FEEDS = 20;
const MAX_HEADLINES_SHOWN = 100;
const AUTO_REFRESH_MS = 10 * 60 * 1000;

// Tape scroll speed in pixels per second.
const TEMPO_SPEED = { slow: 25, medium: 50, fast: 90 };

// How a headline slip is thrown onto the board. Both are picked from a
// hash of the headline itself rather than its position, so a slip keeps
// the same angle when the list reshuffles around it on refresh --
// otherwise the whole board would visibly re-deal every ten minutes.
const SLIP_TILTS = [
  "-1.7deg",
  "1.1deg",
  "-0.6deg",
  "1.6deg",
  "-1.2deg",
  "0.5deg",
];
const SLIP_NUDGES = ["0rem", "0.8rem", "0.25rem", "1.1rem", "0.5rem", "0rem"];
const SLIP_TAPES = [
  "var(--tape-1)",
  "var(--tape-2)",
  "var(--tape-3)",
  "var(--tape-4)",
];

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

/* ---------------------------------------------------------
   Storage -- wrapped in try/catch throughout. Private browsing and
   storage-disabled Safari can throw on setItem; degrade to in-memory
   for the session rather than crash the page.
   --------------------------------------------------------- */

function loadFeeds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_FEEDS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveFeeds(feeds) {
  try {
    localStorage.setItem(STORAGE_KEY_FEEDS, JSON.stringify(feeds));
  } catch {
    /* private browsing / storage disabled -- session stays in memory */
  }
}

function loadTempo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPO);
    return raw in TEMPO_SPEED ? raw : "medium";
  } catch {
    return "medium";
  }
}

function loadFoldOpen() {
  try {
    // Default open: the panel is how you get a feed in at all, and a
    // first-time reader shouldn't have to find it behind a summary.
    return localStorage.getItem(STORAGE_KEY_FOLD) !== "0";
  } catch {
    return true;
  }
}

function saveFoldOpen(open) {
  try {
    localStorage.setItem(STORAGE_KEY_FOLD, open ? "1" : "0");
  } catch {
    /* ignored -- same reasoning as saveFeeds */
  }
}

function saveTempo(tempo) {
  try {
    localStorage.setItem(STORAGE_KEY_TEMPO, tempo);
  } catch {
    /* ignored -- same reasoning as saveFeeds */
  }
}

/* ---------------------------------------------------------
   State
   --------------------------------------------------------- */

let feeds = loadFeeds();
let tempo = loadTempo();
// Ephemeral -- never persisted. feed.id -> array of items.
const itemsByFeedId = new Map();
let running = !prefersReducedMotion;

function normalizeUrl(url) {
  return url.trim().replace(/\/+$/, "");
}

function byId(id) {
  return document.getElementById(id);
}

// FNV-1a. Not for anything that matters -- just a stable way to turn a
// headline into the same tilt every time it's rendered.
function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------------------------------------------------------
   Fetching
   --------------------------------------------------------- */

async function fetchFeedItems(feed) {
  try {
    const res = await fetch(`/api/feed?url=${encodeURIComponent(feed.url)}`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      feed.lastError = (data && data.error) || `http_${res.status}`;
      itemsByFeedId.set(feed.id, itemsByFeedId.get(feed.id) ?? []);
      return;
    }

    feed.title = data.feed.title;
    feed.lastError = null;
    feed.lastFetchedAt = new Date().toISOString();
    itemsByFeedId.set(
      feed.id,
      data.feed.items.map((item) => ({ ...item, sourceTitle: feed.title })),
    );
  } catch {
    feed.lastError = "network_error";
    itemsByFeedId.set(feed.id, itemsByFeedId.get(feed.id) ?? []);
  }
}

async function refreshAllFeeds() {
  await Promise.allSettled(feeds.map(fetchFeedItems));
  saveFeeds(feeds);
  renderAll();
}

/* ---------------------------------------------------------
   Subscription management
   --------------------------------------------------------- */

async function addFeed(rawUrl) {
  const status = byId("add-status");
  status.dataset.state = "";

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    status.dataset.state = "error";
    status.textContent = "that doesn't look like a fetchable URL.";
    return;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    status.dataset.state = "error";
    status.textContent = "only http/https feeds are wired up here.";
    return;
  }

  const normalized = normalizeUrl(parsed.href);
  if (feeds.some((f) => normalizeUrl(f.url) === normalized)) {
    status.dataset.state = "error";
    status.textContent = "already spliced in.";
    return;
  }
  if (feeds.length >= MAX_FEEDS) {
    status.dataset.state = "error";
    status.textContent = `${MAX_FEEDS} feeds is the limit here -- cut one first.`;
    return;
  }

  status.textContent = "splicing in…";

  const feed = {
    id: `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    url: parsed.href,
    title: parsed.hostname,
    addedAt: new Date().toISOString(),
    lastFetchedAt: null,
    lastError: null,
  };

  await fetchFeedItems(feed);

  if (feed.lastError) {
    status.dataset.state = "error";
    status.textContent = `couldn't read that feed (${feed.lastError}) -- added anyway, will retry.`;
  } else {
    status.dataset.state = "ok";
    status.textContent = `live: ${feed.title}`;
  }

  feeds.push(feed);
  saveFeeds(feeds);
  renderAll();
}

function removeFeed(id) {
  feeds = feeds.filter((f) => f.id !== id);
  itemsByFeedId.delete(id);
  saveFeeds(feeds);
  renderAll();
}

/* ---------------------------------------------------------
   Merging + sorting
   --------------------------------------------------------- */

function mergedSortedItems() {
  const all = [];
  for (const items of itemsByFeedId.values()) all.push(...items);

  // Null dates sort last, stably, by original (feed-then-item) order --
  // a feed with no dates at all shouldn't scramble on every refresh.
  const withIndex = all.map((item, i) => ({ item, i }));
  withIndex.sort((a, b) => {
    const ta = a.item.date ? Date.parse(a.item.date) : -Infinity;
    const tb = b.item.date ? Date.parse(b.item.date) : -Infinity;
    if (tb !== ta) return tb - ta;
    return a.i - b.i;
  });
  return withIndex.map((w) => w.item).slice(0, MAX_HEADLINES_SHOWN);
}

/* ---------------------------------------------------------
   Rendering -- textContent throughout; feed content is untrusted.
   --------------------------------------------------------- */

function renderFoldCount() {
  const count = byId("fold-count");
  if (feeds.length === 0) {
    count.textContent = "nothing spliced in";
    return;
  }
  const bits = [`${feeds.length} ${feeds.length === 1 ? "feed" : "feeds"}`];
  const down = feeds.filter((f) => f.lastError).length;
  if (down > 0) bits.push(`${down} no signal`);
  count.textContent = bits.join(" · ");
}

function renderSources() {
  const list = byId("sources-list");
  list.textContent = "";

  for (const feed of feeds) {
    const li = document.createElement("li");
    li.className = "wire__source";

    const title = document.createElement("span");
    title.className = "wire__source__title";
    title.textContent = feed.title || feed.url;
    li.appendChild(title);

    const status = document.createElement("span");
    status.className = "wire__source__status";
    if (feed.lastError) {
      status.dataset.state = "error";
      status.textContent = "no signal";
    } else {
      status.textContent = "live";
    }
    li.appendChild(status);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "wire__source__remove";
    remove.textContent = "cut";
    remove.setAttribute("aria-label", `cut ${feed.title || feed.url}`);
    remove.addEventListener("click", () => removeFeed(feed.id));
    li.appendChild(remove);

    list.appendChild(li);
  }
}

function formatMeta(item) {
  const bits = [item.sourceTitle];
  if (item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      bits.push(
        d.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      );
    }
  }
  return bits.filter(Boolean).join(" — ");
}

function renderHeadlines(items) {
  const list = byId("headlines-list");
  const empty = byId("empty-state");
  list.textContent = "";

  if (items.length === 0) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const item of items) {
    const li = document.createElement("li");
    li.className = "wire__headline";

    const h = hashString(item.link || item.title || "");
    li.style.setProperty("--tilt", SLIP_TILTS[h % SLIP_TILTS.length]);
    li.style.setProperty(
      "--nudge",
      SLIP_NUDGES[(h >>> 3) % SLIP_NUDGES.length],
    );
    li.style.setProperty(
      "--tape",
      SLIP_TAPES[hashString(item.sourceTitle || "") % SLIP_TAPES.length],
    );

    const link = document.createElement("a");
    link.className = "wire__headline__link";
    link.textContent = item.title;
    if (item.link) {
      link.href = item.link;
      link.rel = "noopener";
    }
    li.appendChild(link);

    const meta = document.createElement("span");
    meta.className = "wire__headline__meta";
    meta.textContent = formatMeta(item);
    li.appendChild(meta);

    list.appendChild(li);
  }
}

function renderTape(items) {
  const track = byId("tape-track");
  if (items.length === 0) {
    track.textContent = prefersReducedMotion
      ? ""
      : "nothing on the wire yet — splice in a feed above ▊";
    return;
  }
  const line = items.map((item) => item.title).join("   ★   ");
  // Doubled, back to back, so a -50% scroll loops seamlessly.
  track.textContent = `${line}   ★   ${line}   ★   `;
}

function renderAll() {
  const items = mergedSortedItems();
  renderFoldCount();
  renderSources();
  renderHeadlines(items);
  renderTape(items);
}

/* ---------------------------------------------------------
   The tape -- JS-driven transform, not a CSS @keyframes animation, so
   the stop key can freeze it in place cleanly rather than fighting a
   running animation.
   --------------------------------------------------------- */

let tapeOffset = 0;
let lastFrameTime = null;
let tapeRafId = null;

function tapeStep(timestamp) {
  if (!running) return;

  const track = byId("tape-track");
  if (lastFrameTime === null) lastFrameTime = timestamp;
  const deltaSeconds = (timestamp - lastFrameTime) / 1000;
  lastFrameTime = timestamp;

  tapeOffset -= TEMPO_SPEED[tempo] * deltaSeconds;
  const halfWidth = track.scrollWidth / 2;
  if (halfWidth > 0 && -tapeOffset >= halfWidth) {
    tapeOffset += halfWidth;
  }
  track.style.transform = `translateX(${tapeOffset}px)`;

  tapeRafId = requestAnimationFrame(tapeStep);
}

function startTape() {
  if (tapeRafId !== null) return;
  lastFrameTime = null;
  tapeRafId = requestAnimationFrame(tapeStep);
}

function stopTape() {
  if (tapeRafId !== null) cancelAnimationFrame(tapeRafId);
  tapeRafId = null;
  lastFrameTime = null;
}

/* ---------------------------------------------------------
   Run/stop -- a real <button>, latching, always present and reachable
   regardless of reduced motion: WCAG 2.2.2 (Pause, Stop, Hide) applies
   to any auto-updating content running longer than 5s in parallel with
   other content, independent of a user's motion preference. Reduced
   motion additionally disables the key outright, following the same
   "disable and relabel the auto-running control" precedent the
   character generator's transport uses, rather than just slowing it.
   --------------------------------------------------------- */

function setRunState(isRunning) {
  running = isRunning;
  const key = byId("run-key");
  const legend = byId("run-key-legend");
  const sub = byId("run-key-sub");

  key.setAttribute("aria-pressed", String(isRunning));
  legend.textContent = isRunning ? "stop" : "run";
  sub.textContent = isRunning ? `running — ${tempo}` : "stopped";

  if (isRunning) startTape();
  else stopTape();
}

/* ---------------------------------------------------------
   The fold -- <details> does the collapsing itself; this only restores
   the remembered state and records changes to it.
   --------------------------------------------------------- */

function wireFold() {
  const fold = byId("feeds-fold");
  fold.open = loadFoldOpen();
  fold.addEventListener("toggle", () => saveFoldOpen(fold.open));
}

function wireTransport() {
  const runKey = byId("run-key");

  if (prefersReducedMotion) {
    runKey.disabled = true;
    runKey.setAttribute("aria-pressed", "false");
    byId("run-key-legend").textContent = "run";
    byId("run-key-sub").textContent = "off — reduced motion";
  } else {
    runKey.addEventListener("click", () => setRunState(!running));
  }

  document.querySelectorAll('[name="tempo"]').forEach((radio) => {
    radio.checked = radio.value === tempo;
    radio.addEventListener("change", () => {
      if (!radio.checked) return;
      tempo = radio.value;
      saveTempo(tempo);
      if (running) byId("run-key-sub").textContent = `running — ${tempo}`;
    });
  });

  byId("refresh-key").addEventListener("click", () => {
    byId("refresh-sub").textContent = "reading…";
    refreshAllFeeds().then(() => {
      byId("refresh-sub").textContent = "now";
    });
  });
}

/* ---------------------------------------------------------
   Auto-refresh -- paused entirely while the tab is hidden, catches up
   immediately on return. No server-side caching layer exists for feed
   results, so this interval is what keeps a backgrounded tab from
   polling third-party servers unattended.
   --------------------------------------------------------- */

let autoRefreshTimer = null;

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshTimer = window.setInterval(refreshAllFeeds, AUTO_REFRESH_MS);
}

function stopAutoRefresh() {
  if (autoRefreshTimer !== null) window.clearInterval(autoRefreshTimer);
  autoRefreshTimer = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshAllFeeds();
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

/* ---------------------------------------------------------
   Init
   --------------------------------------------------------- */

byId("add-feed-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const input = byId("feed-url");
  const url = input.value.trim();
  if (!url) return;
  addFeed(url).then(() => {
    input.value = "";
  });
});

wireFold();
wireTransport();
renderAll();
refreshAllFeeds();
if (!prefersReducedMotion) {
  setRunState(true);
} else {
  // The plain headline list above renders unconditionally either way --
  // it's the primary reading surface, not a fallback shown only when
  // the tape can't run.
  stopTape();
}
if (document.visibilityState === "visible") startAutoRefresh();
