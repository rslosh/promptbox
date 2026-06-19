-- ============================================================================
-- Add scene_prompt to prompts and prompt_versions
-- Stores the render-ready scene composition JSON produced by the third
-- (SceneCompose) Gemini pass, which reformats the structured json_prompt.
-- ============================================================================

alter table public.prompts
  add column if not exists scene_prompt jsonb not null default '{}'::jsonb;

comment on column public.prompts.scene_prompt is 'Render-ready scene composition JSON (high_level_description, style_description, compositional_deconstruction) reformatted from json_prompt by the SceneCompose pass.';

alter table public.prompt_versions
  add column if not exists scene_prompt jsonb not null default '{}'::jsonb;

comment on column public.prompt_versions.scene_prompt is 'Snapshot of the scene composition JSON for this prompt version.';
