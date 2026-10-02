-- Ensure the public buckets used for barbershop branding exist in every environment.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatar', 'avatar', true, 5242880, array['image/webp']),
  ('banner', 'banner', true, 10485760, array['image/webp'])
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;