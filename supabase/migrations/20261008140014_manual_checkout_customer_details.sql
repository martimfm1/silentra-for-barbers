-- Store a production-ready snapshot of the business and billing details supplied during manual checkout.
-- The request remains the source of truth for what the customer submitted at the time of purchase.

alter table public.subscription_requests
  add column if not exists billing_name text,
  add column if not exists tax_id text,
  add column if not exists billing_email text,
  add column if not exists phone text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists country text not null default 'PT',
  add column if not exists website text,
  add column if not exists business_type text,
  add column if not exists location_count integer,
  add column if not exists team_size integer,
  add column if not exists customer_message text,
  add column if not exists submitted_at timestamptz;

create index if not exists subscription_requests_tax_id_idx
  on public.subscription_requests (tax_id)
  where tax_id is not null;

create index if not exists subscription_requests_submitted_at_idx
  on public.subscription_requests (submitted_at desc);

alter table public.subscription_requests
  drop constraint if exists subscription_requests_location_count_check;

alter table public.subscription_requests
  add constraint subscription_requests_location_count_check
  check (location_count is null or location_count between 1 and 10000);

alter table public.subscription_requests
  drop constraint if exists subscription_requests_team_size_check;

alter table public.subscription_requests
  add constraint subscription_requests_team_size_check
  check (team_size is null or team_size between 1 and 100000);
