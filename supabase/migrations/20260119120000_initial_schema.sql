-- Migration: Initial schema for Promptbox
-- Purpose: Create all tables for image assets, tags, prompts, versions, and ingestion jobs
-- Created: 2026-01-19

-- ============================================================================
-- TABLE: image_assets
-- Stores metadata for uploaded/imported images
-- ============================================================================
create table public.image_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  hash_sha256 text not null unique,
  source_type text not null check (source_type in ('upload', 'gallery_dl')),
  source_ref text,
  width integer not null default 0,
  height integer not null default 0,
  format text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.image_assets is 'Stores metadata for all image assets including storage path, hash for deduplication, and source information.';
comment on column public.image_assets.storage_path is 'Path to the image in Supabase Storage (image_assets bucket)';
comment on column public.image_assets.hash_sha256 is 'SHA-256 hash of the file for deduplication';
comment on column public.image_assets.source_type is 'How the image was ingested: upload or gallery_dl';
comment on column public.image_assets.source_ref is 'Original filename or source URL';

-- Create index for hash lookups (deduplication)
create unique index idx_image_assets_hash on public.image_assets (hash_sha256);

-- Create index for source filtering
create index idx_image_assets_source_type on public.image_assets (source_type);

-- Create index for date sorting
create index idx_image_assets_created_at on public.image_assets (created_at desc);

-- Enable RLS
alter table public.image_assets enable row level security;

-- RLS Policies for anon role
create policy "anon_select_image_assets"
  on public.image_assets
  for select
  to anon
  using (true);

create policy "anon_insert_image_assets"
  on public.image_assets
  for insert
  to anon
  with check (true);

create policy "anon_update_image_assets"
  on public.image_assets
  for update
  to anon
  using (true);

create policy "anon_delete_image_assets"
  on public.image_assets
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_image_assets"
  on public.image_assets
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_image_assets"
  on public.image_assets
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_image_assets"
  on public.image_assets
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_image_assets"
  on public.image_assets
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- TABLE: asset_tags
-- Stores tags/labels associated with images
-- ============================================================================
create table public.asset_tags (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.image_assets (id) on delete cascade,
  tag text not null,
  confidence numeric,
  created_at timestamptz not null default now()
);

comment on table public.asset_tags is 'Stores tags extracted from images via LLM analysis, with optional confidence scores.';
comment on column public.asset_tags.confidence is 'Confidence score from 0 to 1, where 1 is highest confidence';

-- Create index for fast tag filtering
create index idx_asset_tags_tag on public.asset_tags (tag);

-- Create index for asset lookups
create index idx_asset_tags_asset_id on public.asset_tags (asset_id);

-- Enable RLS
alter table public.asset_tags enable row level security;

-- RLS Policies for anon role
create policy "anon_select_asset_tags"
  on public.asset_tags
  for select
  to anon
  using (true);

create policy "anon_insert_asset_tags"
  on public.asset_tags
  for insert
  to anon
  with check (true);

create policy "anon_update_asset_tags"
  on public.asset_tags
  for update
  to anon
  using (true);

create policy "anon_delete_asset_tags"
  on public.asset_tags
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_asset_tags"
  on public.asset_tags
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_asset_tags"
  on public.asset_tags
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_asset_tags"
  on public.asset_tags
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_asset_tags"
  on public.asset_tags
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- TABLE: prompts
-- Stores generated prompts linked to images
-- ============================================================================
create table public.prompts (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.image_assets (id) on delete cascade,
  json_prompt jsonb not null default '{}'::jsonb,
  natural_prompt text not null default '',
  model_name text not null,
  model_params jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table public.prompts is 'Stores AI-generated prompts for images, including both structured JSON and natural language formats.';
comment on column public.prompts.json_prompt is 'Structured prompt data as JSON (subject, style, lighting, etc.)';
comment on column public.prompts.natural_prompt is 'Natural language prompt suitable for image generation';
comment on column public.prompts.model_name is 'Name of the model used to generate the prompt';
comment on column public.prompts.model_params is 'Parameters used when generating the prompt';

-- Create index for asset lookups
create index idx_prompts_asset_id on public.prompts (asset_id);

-- Create index for model filtering
create index idx_prompts_model_name on public.prompts (model_name);

-- Enable RLS
alter table public.prompts enable row level security;

-- RLS Policies for anon role
create policy "anon_select_prompts"
  on public.prompts
  for select
  to anon
  using (true);

create policy "anon_insert_prompts"
  on public.prompts
  for insert
  to anon
  with check (true);

create policy "anon_update_prompts"
  on public.prompts
  for update
  to anon
  using (true);

create policy "anon_delete_prompts"
  on public.prompts
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_prompts"
  on public.prompts
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_prompts"
  on public.prompts
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_prompts"
  on public.prompts
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_prompts"
  on public.prompts
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- TABLE: prompt_versions
-- Stores version history for prompts
-- ============================================================================
create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  version_index integer not null,
  json_prompt jsonb not null default '{}'::jsonb,
  natural_prompt text not null default '',
  edit_source text not null check (edit_source in ('manual', 'llm', 'voice')),
  created_at timestamptz not null default now()
);

comment on table public.prompt_versions is 'Stores version history for prompts, enabling rollback and tracking edit sources.';
comment on column public.prompt_versions.version_index is 'Sequential version number starting from 1';
comment on column public.prompt_versions.edit_source is 'How this version was created: manual, llm, or voice';

-- Create index for prompt lookups
create index idx_prompt_versions_prompt_id on public.prompt_versions (prompt_id);

-- Create composite index for version ordering
create index idx_prompt_versions_prompt_version on public.prompt_versions (prompt_id, version_index desc);

-- Enable RLS
alter table public.prompt_versions enable row level security;

-- RLS Policies for anon role
create policy "anon_select_prompt_versions"
  on public.prompt_versions
  for select
  to anon
  using (true);

create policy "anon_insert_prompt_versions"
  on public.prompt_versions
  for insert
  to anon
  with check (true);

create policy "anon_update_prompt_versions"
  on public.prompt_versions
  for update
  to anon
  using (true);

create policy "anon_delete_prompt_versions"
  on public.prompt_versions
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_prompt_versions"
  on public.prompt_versions
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_prompt_versions"
  on public.prompt_versions
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_prompt_versions"
  on public.prompt_versions
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_prompt_versions"
  on public.prompt_versions
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- TABLE: ingestion_jobs
-- Tracks ingestion job status for uploads and gallery-dl imports
-- ============================================================================
create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued' check (status in ('queued', 'running', 'failed', 'completed')),
  source_type text not null,
  source_ref text not null,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ingestion_jobs is 'Tracks the status of image ingestion jobs for uploads and gallery-dl imports.';
comment on column public.ingestion_jobs.status is 'Current job status: queued, running, failed, or completed';
comment on column public.ingestion_jobs.error is 'Error message if the job failed';

-- Create index for status filtering
create index idx_ingestion_jobs_status on public.ingestion_jobs (status);

-- Create index for date sorting
create index idx_ingestion_jobs_created_at on public.ingestion_jobs (created_at desc);

-- Enable RLS
alter table public.ingestion_jobs enable row level security;

-- RLS Policies for anon role
create policy "anon_select_ingestion_jobs"
  on public.ingestion_jobs
  for select
  to anon
  using (true);

create policy "anon_insert_ingestion_jobs"
  on public.ingestion_jobs
  for insert
  to anon
  with check (true);

create policy "anon_update_ingestion_jobs"
  on public.ingestion_jobs
  for update
  to anon
  using (true);

create policy "anon_delete_ingestion_jobs"
  on public.ingestion_jobs
  for delete
  to anon
  using (true);

-- RLS Policies for authenticated role
create policy "authenticated_select_ingestion_jobs"
  on public.ingestion_jobs
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_ingestion_jobs"
  on public.ingestion_jobs
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_ingestion_jobs"
  on public.ingestion_jobs
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_ingestion_jobs"
  on public.ingestion_jobs
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- FUNCTION: update_updated_at
-- Automatically updates the updated_at column on row changes
-- ============================================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.update_updated_at is 'Trigger function to automatically update the updated_at column';

-- Create triggers for updated_at
create trigger trg_image_assets_updated_at
  before update on public.image_assets
  for each row
  execute function public.update_updated_at();

create trigger trg_ingestion_jobs_updated_at
  before update on public.ingestion_jobs
  for each row
  execute function public.update_updated_at();
