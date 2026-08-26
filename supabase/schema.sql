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

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
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

-- security definer so the notes policies can consult this table without
-- tripping over its own RLS, which would recurse.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  );
$$;

/* -------------------------------------------------------------- policies */

alter table public.notes enable row level security;
alter table public.admins enable row level security;

drop policy if exists "published notes are world readable" on public.notes;
create policy "published notes are world readable"
  on public.notes for select
  using (status = 'published');

-- Admins additionally see drafts (an unpublished note is a draft, not a
-- deletion -- taking a note down is reversible).
drop policy if exists "admins read every note" on public.notes;
create policy "admins read every note"
  on public.notes for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins write notes" on public.notes;
create policy "admins write notes"
  on public.notes for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins see their own row" on public.admins;
create policy "admins see their own row"
  on public.admins for select
  to authenticated
  using (user_id = auth.uid());

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
