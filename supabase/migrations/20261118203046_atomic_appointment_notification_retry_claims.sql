begin;

-- Reserve a failed appointment email retry atomically. The row update is the
-- serialization point: concurrent requests cannot both acquire the same lease.
create or replace function public.claim_appointment_notification_retry(
  p_audit_log_id uuid,
  p_barbershop_id uuid,
  p_appointment_id uuid,
  p_action text,
  p_claim_token text
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_retry_count integer;
begin
  if p_audit_log_id is null
    or p_barbershop_id is null
    or p_appointment_id is null
    or p_action not in ('rescheduled', 'cancelled')
    or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    raise exception using errcode = '22023',
      message = 'INVALID_APPOINTMENT_NOTIFICATION_RETRY_CLAIM';
  end if;

  update public.audit_logs as event
  set metadata = coalesce(event.metadata, '{}'::jsonb) || jsonb_build_object(
    'notificationRetryInProgress', true,
    'notificationRetryToken', p_claim_token,
    'notificationRetryStartedAt', clock_timestamp(),
    'notificationRetryLeaseUntil', clock_timestamp() + interval '10 minutes',
    'notificationRetryCount',
      case
        when coalesce(event.metadata ->> 'notificationRetryCount', '') ~ '^[0-9]{1,9}$'
          then (event.metadata ->> 'notificationRetryCount')::integer + 1
        else 1
      end
  )
  where event.id = p_audit_log_id
    and event.barbershop_id = p_barbershop_id
    and event.entity_type = 'appointment'
    and event.entity_id = p_appointment_id::text
    and event.action = 'appointment.' || p_action
    and event.actor_type = 'staff'
    and event.metadata ->> 'notificationSent' = 'false'
    and event.metadata ->> 'notificationSkipped' is distinct from 'true'
    and (
      event.metadata ->> 'notificationRetryInProgress' is distinct from 'true'
      or coalesce(
        nullif(event.metadata ->> 'notificationRetryLeaseUntil', '')::timestamptz,
        '-infinity'::timestamptz
      ) <= clock_timestamp()
    )
    -- A newer activity invalidates this retry, even if the caller fetched
    -- the old event immediately before the newer event was written.
    and not exists (
      select 1
      from public.audit_logs as newer
      where newer.barbershop_id = event.barbershop_id
        and newer.entity_type = 'appointment'
        and newer.entity_id = event.entity_id
        and (newer.created_at, newer.id) > (event.created_at, event.id)
    )
  returning (event.metadata ->> 'notificationRetryCount')::integer
  into v_retry_count;

  return v_retry_count;
end;
$function$;

-- Release the lease and persist the provider result only for the request that
-- owns the current claim token. On a confirmed failure, staff can retry again.
create or replace function public.complete_appointment_notification_retry(
  p_audit_log_id uuid,
  p_barbershop_id uuid,
  p_claim_token text,
  p_email_sent boolean
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_completed boolean := false;
begin
  if p_audit_log_id is null
    or p_barbershop_id is null
    or p_claim_token !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or p_email_sent is null
  then
    raise exception using errcode = '22023',
      message = 'INVALID_APPOINTMENT_NOTIFICATION_RETRY_COMPLETION';
  end if;

  update public.audit_logs as event
  set metadata = (
    coalesce(event.metadata, '{}'::jsonb)
      - 'notificationRetryToken'
      - 'notificationRetryLeaseUntil'
  ) || jsonb_build_object(
    'notificationSent', p_email_sent,
    'notificationSkipped', false,
    'notificationRetryInProgress', false,
    'notificationLastAttemptAt', clock_timestamp(),
    'notificationRetryFailed', not p_email_sent
  )
  where event.id = p_audit_log_id
    and event.barbershop_id = p_barbershop_id
    and event.entity_type = 'appointment'
    and event.actor_type = 'staff'
    and event.metadata ->> 'notificationRetryInProgress' = 'true'
    and event.metadata ->> 'notificationRetryToken' = p_claim_token
  returning true into v_completed;

  return coalesce(v_completed, false);
end;
$function$;

revoke all on function public.claim_appointment_notification_retry(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_appointment_notification_retry(uuid, uuid, text, boolean)
  from public, anon, authenticated;

grant execute on function public.claim_appointment_notification_retry(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.complete_appointment_notification_retry(uuid, uuid, text, boolean)
  to service_role;

comment on function public.claim_appointment_notification_retry(uuid, uuid, uuid, text, text)
  is 'Atomically claims a tenant-scoped failed appointment email retry with a ten-minute lease.';
comment on function public.complete_appointment_notification_retry(uuid, uuid, text, boolean)
  is 'Completes a claimed appointment email retry only when the request token still owns the lease.';

notify pgrst, 'reload schema';
commit;