-- ============================================================================
-- Add remote_count tracking to collections
-- Records how many images the source (e.g. a Cosmos cluster or Are.na channel)
-- reported on the last check, so the sidebar can show a "+N pending to sync"
-- badge by comparing remote_count against the locally-stored image_count.
-- Only platforms that expose a cheap remote total (cosmos, are_na) populate it.
-- ============================================================================

alter table public.collections
  add column if not exists remote_count integer;

comment on column public.collections.remote_count is 'Number of images the remote source reported on the last check (cosmos/are_na only). NULL when unknown. Compare with image_count for pending-sync count.';

alter table public.collections
  add column if not exists remote_count_checked_at timestamptz;

comment on column public.collections.remote_count_checked_at is 'When remote_count was last refreshed; used to throttle remote count checks.';
