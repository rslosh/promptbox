-- Migration: Create collections system for Pinterest moodboard sync
-- Purpose: Enable organizing images into collections that can be synced from external sources
-- Created: 2026-01-20

-- ============================================================================
-- TABLE: collections
-- Stores collection/moodboard metadata and sync information
-- ============================================================================
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  platform text not null check (platform in ('pinterest', 'are_na', 'tumblr', 'manual')),
  source_url text,
  cover_image_url text,
  last_synced_at timestamptz,
  sync_cursor text,
  image_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.collections is 'Stores collections/moodboards that organize images and track external sync state.';
comment on column public.collections.slug is 'URL-friendly identifier derived from collection name';
comment on column public.collections.platform is 'Source platform: pinterest, are_na, tumblr, or manual for user-created collections';
comment on column public.collections.source_url is 'Original URL for external collections (e.g., Pinterest board URL)';
comment on column public.collections.cover_image_url is 'URL to cover image for collection display';
comment on column public.collections.last_synced_at is 'Timestamp of last successful sync with external source';
comment on column public.collections.sync_cursor is 'Platform-specific cursor for incremental sync (e.g., last pin ID)';
comment on column public.collections.image_count is 'Cached count of images in collection for display';

-- Create index for slug lookups
create unique index idx_collections_slug on public.collections (slug);

-- Create index for platform filtering
create index idx_collections_platform on public.collections (platform);

-- Create index for date sorting
create index idx_collections_created_at on public.collections (created_at desc);

-- Enable RLS
alter table public.collections enable row level security;

-- RLS Policies for anon role
create policy "anon_select_collections"
  on public.collections
  for select
  to anon
  using (true);

create policy "anon_insert_collections"
  on public.collections
  for insert
  to anon
  with check (true);

create policy "anon_update_collections"
  on public.collections
  for update
  to anon
  using (true);

create policy "anon_delete_collections"
  on public.collections
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_collections"
  on public.collections
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_collections"
  on public.collections
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_collections"
  on public.collections
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_collections"
  on public.collections
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- TABLE: collection_assets
-- Links images to collections (many-to-many relationship)
-- ============================================================================
create table public.collection_assets (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  asset_id uuid not null references public.image_assets (id) on delete cascade,
  position integer not null default 0,
  source_item_id text,
  created_at timestamptz not null default now()
);

comment on table public.collection_assets is 'Links images to collections, enabling many-to-many relationships.';
comment on column public.collection_assets.position is 'Order position within the collection for custom sorting';
comment on column public.collection_assets.source_item_id is 'Platform-specific item ID (e.g., Pinterest pin ID) for deduplication during sync';

-- Create unique constraint to prevent duplicate asset-collection pairs
create unique index idx_collection_assets_unique on public.collection_assets (collection_id, asset_id);

-- Create index for collection lookups
create index idx_collection_assets_collection_id on public.collection_assets (collection_id);

-- Create index for asset lookups (find which collections an image belongs to)
create index idx_collection_assets_asset_id on public.collection_assets (asset_id);

-- Create index for source_item_id lookups (for incremental sync)
create index idx_collection_assets_source_item on public.collection_assets (collection_id, source_item_id);

-- Create index for ordering within collections
create index idx_collection_assets_position on public.collection_assets (collection_id, position);

-- Enable RLS
alter table public.collection_assets enable row level security;

-- RLS Policies for anon role
create policy "anon_select_collection_assets"
  on public.collection_assets
  for select
  to anon
  using (true);

create policy "anon_insert_collection_assets"
  on public.collection_assets
  for insert
  to anon
  with check (true);

create policy "anon_update_collection_assets"
  on public.collection_assets
  for update
  to anon
  using (true);

create policy "anon_delete_collection_assets"
  on public.collection_assets
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_collection_assets"
  on public.collection_assets
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_collection_assets"
  on public.collection_assets
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_collection_assets"
  on public.collection_assets
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_collection_assets"
  on public.collection_assets
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- FUNCTION: update_collection_image_count
-- Automatically updates the image_count on collections when assets are added/removed
-- ============================================================================
create or replace function public.update_collection_image_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.collections
    set image_count = image_count + 1, updated_at = now()
    where id = new.collection_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.collections
    set image_count = image_count - 1, updated_at = now()
    where id = old.collection_id;
    return old;
  end if;
  return null;
end;
$$;

comment on function public.update_collection_image_count is 'Trigger function to maintain accurate image_count on collections';

-- Create triggers for image count updates
create trigger trg_collection_assets_count_insert
  after insert on public.collection_assets
  for each row
  execute function public.update_collection_image_count();

create trigger trg_collection_assets_count_delete
  after delete on public.collection_assets
  for each row
  execute function public.update_collection_image_count();

-- Create trigger for updated_at on collections
create trigger trg_collections_updated_at
  before update on public.collections
  for each row
  execute function public.update_updated_at();
