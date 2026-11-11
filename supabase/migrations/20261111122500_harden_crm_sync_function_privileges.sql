-- Keep the CRM sync trigger helpers inaccessible through the public Data API.
-- Trigger execution runs with the function owner's privileges, so these helpers
-- do not need EXECUTE grants for anon, authenticated, or service_role callers.

alter function public.sync_appointment_crm_client(uuid)
  set search_path = '';

alter function public.trigger_sync_appointment_crm_client()
  set search_path = '';

revoke all on function public.sync_appointment_crm_client(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.trigger_sync_appointment_crm_client()
  from public, anon, authenticated, service_role;
