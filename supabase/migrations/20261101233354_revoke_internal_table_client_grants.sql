begin;

-- These tables are internal queues, audit/configuration data, or token/rate-limit
-- storage. The application accesses them through trusted server-side clients.
-- Remove inherited PUBLIC and client-role privileges as defense in depth;
-- service_role retains explicit access for API routes and workers.
revoke all on table
  public.audit_logs,
  public.email_queue,
  public.notification_queue,
  public.notification_subscriptions,
  public.platform_settings,
  public.rate_limits,
  public.verification_tokens
from public, anon, authenticated;

grant all on table
  public.audit_logs,
  public.email_queue,
  public.notification_queue,
  public.notification_subscriptions,
  public.platform_settings,
  public.rate_limits,
  public.verification_tokens
to service_role;

commit;
