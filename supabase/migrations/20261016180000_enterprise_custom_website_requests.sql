-- Bespoke Enterprise website requests and public path assignments.
-- All reads/writes are performed through authenticated API handlers and the service role.
create table if not exists public.custom_website_requests (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  shop_name text not null,
  booking_slug text not null,
  contact_email text not null,
  desired_slug text not null,
  brief text not null,
  status text not null default 'requested'
    check (status in ('requested', 'contacted', 'in_progress', 'review', 'published', 'rejected')),
  public_slug text,
  site_title text,
  site_description text,
  hero_image_url text,
  primary_cta_label text not null default 'Marcar horário',
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint custom_website_requests_public_slug_format
    check (public_slug is null or public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint custom_website_requests_desired_slug_format
    check (desired_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create unique index if not exists custom_website_requests_public_slug_unique
  on public.custom_website_requests (public_slug)
  where public_slug is not null;

create index if not exists custom_website_requests_status_created_idx
  on public.custom_website_requests (status, created_at desc);

create index if not exists custom_website_requests_shop_created_idx
  on public.custom_website_requests (barbershop_id, created_at desc);

-- Enforce one in-flight project per barbershop even under concurrent submissions.
create unique index if not exists custom_website_requests_one_active_per_shop
  on public.custom_website_requests (barbershop_id)
  where status in ('requested', 'contacted', 'in_progress', 'review');

alter table public.custom_website_requests enable row level security;
revoke all on public.custom_website_requests from anon, authenticated;
grant all on public.custom_website_requests to service_role;

create or replace function public.set_custom_website_request_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at = now();
  elsif new.status <> 'published' then
    new.published_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists custom_website_requests_updated_at on public.custom_website_requests;
create trigger custom_website_requests_updated_at
before update on public.custom_website_requests
for each row execute function public.set_custom_website_request_updated_at();
