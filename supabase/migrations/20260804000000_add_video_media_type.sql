-- Videos become first-class assets: same table, same collections/tags/prompts
-- plumbing. media_type distinguishes them; videos also carry a duration and a
-- poster frame (stored in image_thumbs) for grid/lightbox rendering.

alter table public.image_assets
  add column if not exists media_type text not null default 'image'
    check (media_type in ('image', 'video')),
  add column if not exists duration_seconds numeric,
  add column if not exists poster_path text;

comment on column public.image_assets.media_type is
  'image (default) or video — videos share all asset plumbing';
comment on column public.image_assets.duration_seconds is
  'Video duration in seconds (null for images)';
comment on column public.image_assets.poster_path is
  'Storage path (image_thumbs bucket) of the extracted poster frame for videos';

-- Filterable gallery queries hit this constantly once videos exist.
create index if not exists idx_image_assets_media_type
  on public.image_assets (media_type);
