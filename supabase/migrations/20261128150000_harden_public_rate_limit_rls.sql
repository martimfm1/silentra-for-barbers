-- Defense-in-depth for the opaque public rate-limit buckets.
-- The table remains accessible only to the SECURITY DEFINER RPC owned by a trusted role.
alter table public.public_rate_limit_buckets enable row level security;

revoke all on table public.public_rate_limit_buckets
  from public, anon, authenticated;

-- The function references application objects with schema-qualified names;
-- pin the search path to an empty value to prevent object-shadowing attacks.
alter function public.consume_public_rate_limit(text, integer, integer)
  set search_path = '';

revoke all on function public.consume_public_rate_limit(text, integer, integer)
  from public, anon, authenticated;
