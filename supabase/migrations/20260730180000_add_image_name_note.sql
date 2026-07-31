-- Editable display name and free-form note for images, shown in the
-- lightbox Details panel (GatherOS-style).
alter table public.image_assets
  add column if not exists name text,
  add column if not exists note text;

comment on column public.image_assets.name is 'User-editable display name shown in the image Details panel';
comment on column public.image_assets.note is 'Free-form user note shown in the image Details panel';
