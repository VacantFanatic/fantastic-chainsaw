-- Field notes schema. Run once in the Supabase SQL editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
--
-- The security model in one line: the app never holds a service-role key.
-- Readers get the anon key, which row-level security limits to published
-- notes. Writes are performed as the signed-in admin's own session, so the
-- database -- not the application -- is what decides whether a write is
-- allowed. Compromising the front end does not grant write access.

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ notes */

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null check (length(title) between 1 and 200),
  body text not null check (length(body) between 1 and 20000),
  excerpt text not null default '',
  -- Preview cards for standalone links, fetched once when the note is
  -- saved and stored here. Readers never trigger an outbound fetch.
  link_previews jsonb not null default '{}'::jsonb,
  status text not null default 'published'
    check (status in ('published', 'draft')),
  -- Set once, on first publish, and never touched again: a published URL
  -- is a promise and an edit is not a republish.
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The listing's only query: published notes, newest first.
create index if not exists notes_published_idx
  on public.notes (status, published_at desc);

-- search_path is pinned empty so the function cannot be hijacked by a
-- role-local search_path pointing at a shadowing schema. It touches no
-- objects, so it needs nothing on the path.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_touch_updated_at on public.notes;
create trigger notes_touch_updated_at
  before update on public.notes
  for each row execute function public.touch_updated_at();

/* ----------------------------------------------------------------- admins */

-- Membership here is the only thing that grants write access. Being a
-- Supabase user is not enough, so even if signups were ever left open,
-- a new account can read exactly what the public can read.
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text,
  added_at timestamptz not null default now()
);

-- Not in public, and that is the point. Anything in public is published by
-- PostgREST as /rest/v1/rpc/<name>, so a security definer function there is
-- a callable endpoint for every anon and signed-in caller. This one is only
-- ever meant to be consulted from inside a policy, so it lives in a schema
-- the API does not expose.
create schema if not exists private;

-- security definer so the notes policies can consult admins without
-- tripping over its own RLS, which would recurse.
create or replace function private.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

-- Default grants hand EXECUTE to public; take it back and hand it only to
-- the role the policies actually run as.
revoke all on function private.is_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

/* -------------------------------------------------------------- policies */

alter table public.notes enable row level security;
alter table public.admins enable row level security;

-- One SELECT policy per role, deliberately. Permissive policies covering
-- the same role and action are OR-ed, and Postgres evaluates every one of
-- them against every row -- so the old "public reads published / admins
-- also read drafts" split cost an extra policy evaluation per row on every
-- authenticated read. The same rule states fine as one predicate per role.
drop policy if exists "published notes are world readable" on public.notes;
drop policy if exists "admins read every note" on public.notes;
drop policy if exists "admins write notes" on public.notes;

drop policy if exists "signed-out readers see published notes" on public.notes;
create policy "signed-out readers see published notes"
  on public.notes for select
  to anon
  using (status = 'published');

-- Being signed in still grants nothing on its own: a non-admin sees exactly
-- what anon sees. Admins additionally see drafts, because an unpublished
-- note is a draft, not a deletion -- taking a note down is reversible.
drop policy if exists "signed-in readers see published, admins see drafts" on public.notes;
create policy "signed-in readers see published, admins see drafts"
  on public.notes for select
  to authenticated
  using (status = 'published' or (select private.is_admin()));

-- Split by action rather than one `for all` policy, because `for all`
-- counts as a SELECT policy too and would put a second one straight back
-- onto every authenticated read.
drop policy if exists "admins insert notes" on public.notes;
create policy "admins insert notes"
  on public.notes for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists "admins update notes" on public.notes;
create policy "admins update notes"
  on public.notes for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

-- Nothing in the app deletes a note -- unpublishing sets status to draft --
-- but the old `for all` policy allowed it, and this is a performance fix,
-- not the place to quietly take a capability away.
drop policy if exists "admins delete notes" on public.notes;
create policy "admins delete notes"
  on public.notes for delete
  to authenticated
  using ((select private.is_admin()));

-- `(select auth.uid())`, not a bare `auth.uid()`: wrapped in a sub-select
-- it is hoisted to an InitPlan and evaluated once per query instead of once
-- per row. Same reason for the `(select private.is_admin())` calls above.
drop policy if exists "admins see their own row" on public.admins;
create policy "admins see their own row"
  on public.admins for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The old public copy, if this is a re-run against a database that predates
-- the move. Dropped last, once nothing references it any more.
drop function if exists public.is_admin();

/* ------------------------------------------------------------------ setup */

-- After creating your user (Dashboard -> Authentication -> Users -> Add
-- user), grant it admin rights by email:
--
--   insert into public.admins (user_id, email)
--   select id, email from auth.users where email = 'you@example.com';
--
-- Then turn public signups off:
--   Dashboard -> Authentication -> Sign In / Providers -> Email ->
--   disable "Allow new users to sign up".
--
-- And turn leaked password protection on -- it is a project setting, not
-- something this file can express:
--   Dashboard -> Authentication -> Policies (Password protection) ->
--   enable "Prevent use of leaked passwords".
