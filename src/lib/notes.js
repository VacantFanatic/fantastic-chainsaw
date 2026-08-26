// Everything the site does to a field note, in one place, so the Astro
// routes stay thin and the rules live somewhere testable.
//
// Reads run anonymously and rely on row-level security to return only
// published notes. Writes run as the signed-in admin's session and rely on
// the same policies to reject anyone else. Neither path re-implements
// permission checks in JavaScript, because the database already has them
// and two copies of a rule is one copy too many.

import {
  RenderError,
  extractStandaloneLinks,
  fetchLinkPreviews,
  makeExcerpt,
  slugify,
  uniqueSlug,
} from "./render.mjs";

const COLUMNS =
  "slug, title, body, excerpt, link_previews, status, published_at, updated_at";

function fail(error, code, status = 500) {
  throw new RenderError(status, code, error?.message ?? code);
}

/* ------------------------------------------------------------------ reads */

export async function listPublished(supabase) {
  const { data, error } = await supabase
    .from("notes")
    .select(COLUMNS)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) fail(error, "list_failed", 502);
  return data ?? [];
}

// Admin view: drafts included, so an unpublished note can be found again
// and put back. RLS returns drafts only to an admin session.
export async function listAll(supabase) {
  const { data, error } = await supabase
    .from("notes")
    .select(COLUMNS)
    .order("published_at", { ascending: false });

  if (error) fail(error, "list_failed", 502);
  return data ?? [];
}

export async function getBySlug(supabase, slug) {
  const { data, error } = await supabase
    .from("notes")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();

  if (error) fail(error, "read_failed", 502);
  return data ?? null;
}

/* ----------------------------------------------------------------- writes */

function validate(title, body) {
  if (typeof title !== "string" || typeof body !== "string") {
    throw new RenderError(400, "missing_fields", "title and body are required");
  }
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle || !cleanBody) {
    throw new RenderError(400, "missing_fields", "title and body are required");
  }
  if (cleanTitle.length > 200 || cleanBody.length > 20000) {
    throw new RenderError(400, "too_long", "title or body is too long");
  }
  return { title: cleanTitle, body: cleanBody };
}

// Link previews are fetched here, once, when the note is saved -- never on
// a reader's behalf. Same rule as the old static build had: a visitor's
// pageview must not trigger an outbound request to someone else's server.
async function previewsFor(body) {
  const links = extractStandaloneLinks(body);
  if (links.length === 0) return {};
  const map = await fetchLinkPreviews(links);
  return Object.fromEntries(map);
}

export async function createNote(supabase, rawTitle, rawBody) {
  const { title, body } = validate(rawTitle, rawBody);

  // Slug uniqueness is decided against what's already there, drafts
  // included -- an unpublished note still owns its URL, because taking it
  // down is reversible and its slug shouldn't be quietly reassigned.
  const { data: existing, error: slugError } = await supabase
    .from("notes")
    .select("slug");
  if (slugError) fail(slugError, "list_failed", 502);

  const slug = uniqueSlug(slugify(title), existing ?? []);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      slug,
      title,
      body,
      excerpt: makeExcerpt(body),
      link_previews: await previewsFor(body),
      status: "published",
    })
    .select(COLUMNS)
    .single();

  if (error) fail(error, "insert_failed", 502);
  return data;
}

// An edit revises a note; it does not republish it. The slug and
// published_at are never in the update payload, so neither the URL nor the
// note's position in the listing can move.
export async function updateNote(supabase, slug, rawTitle, rawBody) {
  const { title, body } = validate(rawTitle, rawBody);

  const { data, error } = await supabase
    .from("notes")
    .update({
      title,
      body,
      excerpt: makeExcerpt(body),
      link_previews: await previewsFor(body),
    })
    .eq("slug", slug)
    .select(COLUMNS)
    .maybeSingle();

  if (error) fail(error, "update_failed", 502);
  if (!data) {
    throw new RenderError(404, "not_found", `no note with slug "${slug}"`);
  }
  return data;
}

// Unpublishing is a status change, not a delete. The old version removed
// the files outright and leaned on git history as the undo; a draft row is
// a better answer, and putting a note back is now a button rather than an
// archaeology exercise.
export async function setStatus(supabase, slug, status) {
  if (status !== "published" && status !== "draft") {
    throw new RenderError(
      400,
      "bad_status",
      "status must be published or draft",
    );
  }

  const { data, error } = await supabase
    .from("notes")
    .update({ status })
    .eq("slug", slug)
    .select(COLUMNS)
    .maybeSingle();

  if (error) fail(error, "status_failed", 502);
  if (!data) {
    throw new RenderError(404, "not_found", `no note with slug "${slug}"`);
  }
  return data;
}
