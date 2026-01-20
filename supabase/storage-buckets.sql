-- Storage bucket configuration for Promptbox
-- Run this in the Supabase SQL Editor to create the required buckets

-- Create image_assets bucket for original images
insert into storage.buckets (id, name, public)
values ('image_assets', 'image_assets', true)
on conflict (id) do nothing;

-- Create image_thumbs bucket for thumbnails
insert into storage.buckets (id, name, public)
values ('image_thumbs', 'image_thumbs', true)
on conflict (id) do nothing;

-- RLS Policies for image_assets bucket
-- Allow public read access
create policy "Public read access for image_assets"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'image_assets');

-- Allow anon and authenticated to upload
create policy "Allow upload to image_assets"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'image_assets');

-- Allow anon and authenticated to update
create policy "Allow update to image_assets"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'image_assets');

-- Allow anon and authenticated to delete
create policy "Allow delete from image_assets"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'image_assets');

-- RLS Policies for image_thumbs bucket
-- Allow public read access
create policy "Public read access for image_thumbs"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'image_thumbs');

-- Allow anon and authenticated to upload
create policy "Allow upload to image_thumbs"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'image_thumbs');

-- Allow anon and authenticated to update
create policy "Allow update to image_thumbs"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'image_thumbs');

-- Allow anon and authenticated to delete
create policy "Allow delete from image_thumbs"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'image_thumbs');
