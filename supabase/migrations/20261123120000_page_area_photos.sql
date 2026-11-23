-- Phase 8: a photo on the About page and on each expertise area (§6.3, §6.4),
-- as in the approved mockups. Additive only: every column is nullable, so the
-- deployed code keeps working while this runs.
-- `image_path` is a key in the public `media` bucket, like partners.logo_path.
-- Limits match packages/shared: alt ≤ 300, caption ≤ 200.
-- RLS and grants on both tables stay as they are: anon reads nothing, and
-- the public pages read through the service client (lib/content).

alter table public.pages
  add column image_path text,
  add column image_alt_ar text check (char_length(image_alt_ar) <= 300),
  add column image_alt_en text check (char_length(image_alt_en) <= 300),
  add column image_caption_ar text check (char_length(image_caption_ar) <= 200),
  add column image_caption_en text check (char_length(image_caption_en) <= 200);

alter table public.expertise_areas
  add column image_path text,
  add column image_alt_ar text check (char_length(image_alt_ar) <= 300),
  add column image_alt_en text check (char_length(image_alt_en) <= 300),
  add column image_caption_ar text check (char_length(image_caption_ar) <= 200),
  add column image_caption_en text check (char_length(image_caption_en) <= 200);
