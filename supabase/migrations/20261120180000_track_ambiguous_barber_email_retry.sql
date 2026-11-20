begin;

-- Replace the original completion signature so ambiguous provider outcomes are
-- persisted as "unknown" and can never be retried automatically.
drop function if exists public.complete_appointment_barber_notification_retry(
  uuid, uuid, text, boolean, integer, integer, integer, boolean, integer, integer
);

create function public.complete_appointment_barber_notification_retry(
  p_audit_log_id uuid,
  p_barbershop_id uuid,
  p_claim_token text,
  p_retry_email boolean,
  p_emails_attempted integer,
  p_emails_sent integer,
  p_emails_failed integer,
  p_emails_unknown integer,
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
    or p_emails_unknown is null or p_emails_unknown < 0
    or p_emails_unknown > p_emails_failed
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
        when p_retry_email and (p_emails_failed > 0 or p_emails_unknown > 0) then true
        when p_retry_push and p_push_failed > 0 then true
        else false
      end
  ) || case when p_retry_email then jsonb_build_object(
    'barberEmailsAttempted', coalesce((event.metadata ->> 'barberEmailsAttempted')::integer, 0) + p_emails_attempted,
    'barberEmailsSent', coalesce((event.metadata ->> 'barberEmailsSent')::integer, 0) + p_emails_sent,
    'barberEmailsFailed', p_emails_failed,
    'barberEmailsUnknown', p_emails_unknown,
    'barberEmailStatus',
      case
        when p_emails_attempted = 0 then 'no_target'
        when p_emails_unknown > 0 then 'unknown'
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

revoke all on function public.complete_appointment_barber_notification_retry(uuid, uuid, text, boolean, integer, integer, integer, integer, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.complete_appointment_barber_notification_retry(uuid, uuid, text, boolean, integer, integer, integer, integer, boolean, integer, integer)
  to service_role;

comment on function public.complete_appointment_barber_notification_retry(uuid, uuid, text, boolean, integer, integer, integer, integer, boolean, integer, integer)
  is 'Completes barber email/push retry and marks ambiguous email outcomes unknown so they cannot be replayed.';

notify pgrst, 'reload schema';
commit;
