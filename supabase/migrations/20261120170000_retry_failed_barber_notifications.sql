begin;

create or replace function public.claim_appointment_barber_notification_retry(
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
      message = 'INVALID_APPOINTMENT_BARBER_NOTIFICATION_RETRY_CLAIM';
  end if;

  update public.audit_logs as event
  set metadata = coalesce(event.metadata, '{}'::jsonb) || jsonb_build_object(
    'barberNotificationRetryInProgress', true,
    'barberNotificationRetryToken', p_claim_token,
    'barberNotificationRetryStartedAt', clock_timestamp(),
    'barberNotificationRetryLeaseUntil', clock_timestamp() + interval '10 minutes',
    'barberNotificationRetryCount',
      case
        when coalesce(event.metadata ->> 'barberNotificationRetryCount', '') ~ '^[0-9]{1,9}$'
          then (event.metadata ->> 'barberNotificationRetryCount')::integer + 1
        else 1
      end
  )
  where event.id = p_audit_log_id
    and event.barbershop_id = p_barbershop_id
    and event.entity_type = 'appointment'
    and event.entity_id = p_appointment_id::text
    and event.action = 'appointment.' || p_action
    and event.actor_type = 'customer'
    -- Retry only a channel that failed for every recipient. Partial delivery
    -- is deliberately not retried because recipient-level receipts are not
    -- stored and replaying it could duplicate a successful delivery.
    and (
      event.metadata ->> 'barberEmailStatus' = 'failed'
      or event.metadata ->> 'barberPushStatus' = 'failed'
    )
    and (
      event.metadata ->> 'barberNotificationRetryInProgress' is distinct from 'true'
      or coalesce(
        nullif(event.metadata ->> 'barberNotificationRetryLeaseUntil', '')::timestamptz,
        '-infinity'::timestamptz
      ) <= clock_timestamp()
    )
    and not exists (
      select 1
      from public.audit_logs as newer
      where newer.barbershop_id = event.barbershop_id
        and newer.entity_type = 'appointment'
        and newer.entity_id = event.entity_id
        and (newer.created_at, newer.id) > (event.created_at, event.id)
    )
  returning (event.metadata ->> 'barberNotificationRetryCount')::integer
  into v_retry_count;

  return v_retry_count;
end;
$function$;

create or replace function public.complete_appointment_barber_notification_retry(
  p_audit_log_id uuid,
  p_barbershop_id uuid,
  p_claim_token text,
  p_retry_email boolean,
  p_emails_attempted integer,
  p_emails_sent integer,
  p_emails_failed integer,
  p_retry_push boolean,
  p_push_sent integer,
  p_push_failed integer
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
    or p_retry_email is null
    or p_retry_push is null
    or (not p_retry_email and not p_retry_push)
    or p_emails_attempted is null or p_emails_attempted < 0
    or p_emails_sent is null or p_emails_sent < 0
    or p_emails_failed is null or p_emails_failed < 0
    or p_push_sent is null or p_push_sent < 0
    or p_push_failed is null or p_push_failed < 0
    or p_emails_sent + p_emails_failed > p_emails_attempted
  then
    raise exception using errcode = '22023',
      message = 'INVALID_APPOINTMENT_BARBER_NOTIFICATION_RETRY_COMPLETION';
  end if;

  update public.audit_logs as event
  set metadata = (
    coalesce(event.metadata, '{}'::jsonb)
      - 'barberNotificationRetryToken'
      - 'barberNotificationRetryLeaseUntil'
  ) || jsonb_build_object(
    'barberNotificationRetryInProgress', false,
    'barberNotificationLastAttemptAt', clock_timestamp(),
    'barberNotificationRetryFailed',
      case
        when p_retry_email and p_emails_failed > 0 then true
        when p_retry_push and p_push_failed > 0 then true
        else false
      end
  ) || case when p_retry_email then jsonb_build_object(
    'barberEmailsAttempted', coalesce((event.metadata ->> 'barberEmailsAttempted')::integer, 0) + p_emails_attempted,
    'barberEmailsSent', coalesce((event.metadata ->> 'barberEmailsSent')::integer, 0) + p_emails_sent,
    'barberEmailsFailed', p_emails_failed,
    'barberEmailStatus',
      case
        when p_emails_attempted = 0 then 'no_target'
        when p_emails_failed > 0 and p_emails_sent > 0 then 'partial'
        when p_emails_failed > 0 then 'failed'
        else 'sent'
      end
  ) else '{}'::jsonb end
  || case when p_retry_push then jsonb_build_object(
    'barberPushSent', coalesce((event.metadata ->> 'barberPushSent')::integer, 0) + p_push_sent,
    'barberPushFailed', p_push_failed,
    'barberPushStatus',
      case
        when p_push_failed > 0 and p_push_sent > 0 then 'partial'
        when p_push_failed > 0 then 'failed'
        when p_push_sent > 0 then 'sent'
        else 'no_delivery'
      end
  ) else '{}'::jsonb end
  where event.id = p_audit_log_id
    and event.barbershop_id = p_barbershop_id
    and event.entity_type = 'appointment'
    and event.actor_type = 'customer'
    and event.metadata ->> 'barberNotificationRetryInProgress' = 'true'
    and event.metadata ->> 'barberNotificationRetryToken' = p_claim_token
  returning true into v_completed;

  return coalesce(v_completed, false);
end;
$function$;

revoke all on function public.claim_appointment_barber_notification_retry(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_appointment_barber_notification_retry(uuid, uuid, text, boolean, integer, integer, integer, boolean, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_appointment_barber_notification_retry(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.complete_appointment_barber_notification_retry(uuid, uuid, text, boolean, integer, integer, integer, boolean, integer, integer)
  to service_role;

comment on function public.claim_appointment_barber_notification_retry(uuid, uuid, uuid, text, text)
  is 'Atomically claims a failed customer-originated barbershop notification retry with a ten-minute lease.';
comment on function public.complete_appointment_barber_notification_retry(uuid, uuid, text, boolean, integer, integer, integer, boolean, integer, integer)
  is 'Completes failed email/push channel retries only for the request that owns the current lease.';

notify pgrst, 'reload schema';
commit;
