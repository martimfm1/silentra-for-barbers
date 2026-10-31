-- Send one email notification for every accepted support message.
-- Keep the outbox insert inside the same transaction as the message insert;
-- the application dispatches the email after the RPC commits.

create or replace function public.support_send_message(
  p_conversation_id uuid,
  p_sender_type text,
  p_sender_user_id uuid,
  p_body text,
  p_recipient_email text,
  p_recipient_name text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_conversation public.support_conversations%rowtype;
  v_message_id uuid;
  v_notification_id uuid;
  v_recipient_type text;
  v_now timestamptz := pg_catalog.now();
  v_preview text;
begin
  if p_sender_type not in ('customer', 'admin') then
    raise exception 'SUPPORT_INVALID_SENDER' using errcode = '22023';
  end if;
  if p_body is null or pg_catalog.char_length(pg_catalog.btrim(p_body)) < 1 or pg_catalog.char_length(p_body) > 4000 then
    raise exception 'SUPPORT_INVALID_MESSAGE' using errcode = '22023';
  end if;
  if p_recipient_email is null or pg_catalog.btrim(p_recipient_email) = '' then
    raise exception 'SUPPORT_RECIPIENT_REQUIRED' using errcode = '22023';
  end if;

  select * into v_conversation
  from public.support_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'SUPPORT_CONVERSATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_recipient_type := case when p_sender_type = 'customer' then 'admin' else 'customer' end;

  insert into public.support_messages (
    conversation_id, sender_type, sender_user_id, body, created_at
  ) values (
    p_conversation_id, p_sender_type, p_sender_user_id, pg_catalog.btrim(p_body), v_now
  ) returning id into v_message_id;

  v_preview := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(p_body), '[[:space:]]+', ' ', 'g'), 200);

  update public.support_conversations
  set status = case when p_sender_type = 'customer' then 'open' else 'waiting_customer' end,
      last_message_at = v_now,
      last_message_preview = v_preview,
      updated_at = v_now
  where id = p_conversation_id;

  -- Every message has a unique outbox entry for its recipient. Never batch by
  -- unread state: the product promise is one email notification per message.
  insert into public.support_email_notifications (
    conversation_id, message_id, recipient_type, recipient_email,
    recipient_name, status, next_attempt_at
  ) values (
    p_conversation_id, v_message_id, v_recipient_type, pg_catalog.lower(pg_catalog.btrim(p_recipient_email)),
    nullif(pg_catalog.btrim(coalesce(p_recipient_name, '')), ''), 'pending', v_now
  )
  on conflict (message_id, recipient_type) do nothing
  returning id into v_notification_id;

  return pg_catalog.jsonb_build_object(
    'message_id', v_message_id,
    'notification_id', v_notification_id,
    'notification_queued', v_notification_id is not null
  );
end;
$$;

revoke all on function public.support_send_message(uuid, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.support_send_message(uuid, text, uuid, text, text, text) to service_role;

comment on table public.support_email_notifications is
  'Transactional email outbox: one notification per support message and recipient, retried with backoff on failure.';
