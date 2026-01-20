-- Migration: Create playground_remixes table
-- Purpose: Store playground sessions with selected images, prompt components, and generated prompts
-- Created: 2026-01-19

-- ============================================================================
-- TABLE: playground_remixes
-- Stores playground sessions for remixing prompts from multiple images
-- ============================================================================
create table public.playground_remixes (
  id uuid primary key default gen_random_uuid(),
  name text,
  image_ids uuid[] not null,
  prompt_components jsonb not null default '[]'::jsonb,
  edit_instructions text not null default '',
  generated_prompt text not null default '',
  history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.playground_remixes is 'Stores playground remix sessions including selected images, prompt components, and generation history.';
comment on column public.playground_remixes.name is 'Optional user-defined name for the remix session';
comment on column public.playground_remixes.image_ids is 'Array of image asset UUIDs selected for this remix';
comment on column public.playground_remixes.prompt_components is 'JSON array of prompt components extracted from selected images';
comment on column public.playground_remixes.edit_instructions is 'User-provided instructions for modifying the prompt';
comment on column public.playground_remixes.generated_prompt is 'The most recently generated prompt from the LLM';
comment on column public.playground_remixes.history is 'JSON array of previously generated prompts for this session';

-- Create index for date sorting (most recent remixes first)
create index idx_playground_remixes_created_at on public.playground_remixes (created_at desc);

-- Create index for updated_at to find recently modified remixes
create index idx_playground_remixes_updated_at on public.playground_remixes (updated_at desc);

-- Enable RLS
alter table public.playground_remixes enable row level security;

-- ============================================================================
-- RLS Policies for anon role
-- These policies allow anonymous access for local development without auth
-- ============================================================================
create policy "anon_select_playground_remixes"
  on public.playground_remixes
  for select
  to anon
  using (true);

create policy "anon_insert_playground_remixes"
  on public.playground_remixes
  for insert
  to anon
  with check (true);

create policy "anon_update_playground_remixes"
  on public.playground_remixes
  for update
  to anon
  using (true);

create policy "anon_delete_playground_remixes"
  on public.playground_remixes
  for delete
  to anon
  using (true);

-- ============================================================================
-- RLS Policies for authenticated role
-- These policies allow full access for authenticated users
-- ============================================================================
create policy "authenticated_select_playground_remixes"
  on public.playground_remixes
  for select
  to authenticated
  using (true);

create policy "authenticated_insert_playground_remixes"
  on public.playground_remixes
  for insert
  to authenticated
  with check (true);

create policy "authenticated_update_playground_remixes"
  on public.playground_remixes
  for update
  to authenticated
  using (true);

create policy "authenticated_delete_playground_remixes"
  on public.playground_remixes
  for delete
  to authenticated
  using (true);

-- ============================================================================
-- Trigger for updated_at
-- Uses the existing update_updated_at function from initial_schema migration
-- ============================================================================
create trigger trg_playground_remixes_updated_at
  before update on public.playground_remixes
  for each row
  execute function public.update_updated_at();
