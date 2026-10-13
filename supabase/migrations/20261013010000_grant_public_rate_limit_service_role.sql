-- Public API rate limiting is invoked through the Supabase service-role client.
-- Explicitly grant function execution after the original migration revoked PUBLIC.
grant execute on function public.consume_public_rate_limit(text, integer, integer)
  to service_role;
