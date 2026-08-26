-- The three field notes that existed before the move to Supabase,
-- carried over verbatim: same slugs, same titles, same publication dates,
-- same link preview cards. Their URLs keep working because the slugs and
-- dates are preserved and /pages/field-notes/posts/<slug>.html redirects
-- permanently to /field-notes/<slug>.
--
-- Generated once from posts.json, sources/*.txt and the rendered pages.
-- Run after schema.sql, in the Supabase SQL editor. Safe to run twice.

insert into public.notes
  (slug, title, body, excerpt, link_previews, status, published_at)
values
  ('going-to-see-mt-joy', 'Going to See Mt. Joy!', 'https://youtu.be/cv7-qdvYht8?si=WYG-MAVt-j5vAcOx', 'https://youtu.be/cv7-qdvYht8?si=WYG-MAVt-j5vAcOx', '{}'::jsonb, 'published', '2026-08-26T17:19:28.677Z'),
  ('going-to-see-mt-joy-2', 'Going to see Mt. Joy!', 'https://youtu.be/cv7-qdvYht8?si=WYG-MAVt-j5vAcOx', 'https://youtu.be/cv7-qdvYht8?si=WYG-MAVt-j5vAcOx', '{}'::jsonb, 'published', '2026-08-26T17:29:04.816Z'),
  ('hell-yeah-brother', 'Hell Yeah Brother!', 'Dark Sun original creators reunite for new D&D book that you can play like in the 1990s!!!

https://www.polygon.com/dnd-dark-sun-original-creators-reunite-dragon-kings/

https://www.backerkit.com/c/projects/strange-owl-games/dragon-kings/pre-launch', 'Dark Sun original creators reunite for new D&D book that you can play like in the 1990s!!!…', '{"https://www.polygon.com/dnd-dark-sun-original-creators-reunite-dragon-kings/":{"url":"https://www.polygon.com/dnd-dark-sun-original-creators-reunite-dragon-kings/","title":"Dark Sun Original Creators Reunite for New D&D Book That You Can Play Like in the 1990s","description":"A new campaign setting aims to recreate the feel of the original Dark Sun","image":"https://static0.polygonimages.com/wordpress/wp-content/uploads/2026/08/dark-sun-d-d-header.jpg?w=1600&h=900&fit=crop"}}'::jsonb, 'published', '2026-08-26T18:22:37.289Z')
on conflict (slug) do nothing;
