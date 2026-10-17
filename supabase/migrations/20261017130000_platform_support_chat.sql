-- Platform support chat: one private thread per barbershop owner.
-- All reads/writes happen through authenticated server routes using service_role.
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  customer_user_id uuid not null references public.users(id) on delete cascade,
  subject text not null default 'Suporte Silentra',
  status text not null default 'open'
    check (status in ('open', 'waiting_customer', 'closed')),
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'enterprise')),
  priority smallint not null default 1
    check (priority between 1 and 3),
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barbershop_id)
);

create index if not exists support_conversations_priority_activity_idx
  on public.support_conversations (priority desc, last_message_at desc nulls last);
create index if not exists support_conversations_customer_idx
  on public.support_conversations (customer_user_id, updated_at desc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('customer', 'admin')),
  sender_user_id uuid references public.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at desc);
create index if not exists support_messages_unread_idx
  on public.support_messages (conversation_id, sender_type, read_at)
  where read_at is null;

create table if not exists public.support_email_notifications (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  message_id uuid not null references public.support_messages(id) on delete cascade,
  recipient_type text not null check (recipient_type in ('customer', 'admin')),
  recipient_email text not null,
  recipient_name text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (message_id, recipient_type)
);

create index if not exists support_email_notifications_due_idx
  on public.support_email_notifications (next_attempt_at, created_at)
  where status in ('pending', 'processing', 'failed') and attempts < 5;

comment on table public.support_conversations is
  'Private platform-level support inbox. One conversation per barbershop; priority is derived server-side from effective plan.';
comment on table public.support_messages is
  'Private customer/platform-admin support messages. Message content is plain text, never HTML.';
comment on table public.support_email_notifications is
  'Transactional email outbox for first-unread-batch notifications; failures are retried with backoff.';

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_email_notifications enable row level security;
revoke all on public.support_conversations from anon, authenticated;
revoke all on public.support_messages from anon, authenticated;
revoke all on public.support_email_notifications from anon, authenticated;
grant select, insert, update, delete on public.support_conversations to service_role;
grant select, insert, update, delete on public.support_messages to service_role;
grant select, insert, update, delete on public.support_email_notifications to service_role;

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
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation public.support_conversations%rowtype;
  v_message_id uuid;
  v_notification_id uuid;
  v_recipient_type text;
  v_unread_count integer;
  v_now timestamptz := now();
  v_preview text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SUPPORT_SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_sender_type not in ('customer', 'admin') then
    raise exception 'SUPPORT_INVALID_SENDER' using errcode = '22023';
  end if;
  if p_body is null or char_length(btrim(p_body)) < 1 or char_length(p_body) > 4000 then
    raise exception 'SUPPORT_INVALID_MESSAGE' using errcode = '22023';
  end if;
  if p_recipient_email is null or btrim(p_recipient_email) = '' then
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

  -- Notify only when the recipient had no unread messages before this send.
  -- The row lock serializes concurrent sends to the same conversation.
  select count(*) into v_unread_count
  from public.support_messages
  where conversation_id = p_conversation_id
    and sender_type <> v_recipient_type
    and read_at is null;

  insert into public.support_messages (
    conversation_id, sender_type, sender_user_id, body, created_at
  ) values (
    p_conversation_id, p_sender_type, p_sender_user_id, btrim(p_body), v_now
  ) returning id into v_message_id;

  v_preview := left(regexp_replace(btrim(p_body), '[[:space:]]+', ' ', 'g'), 200);

  update public.support_conversations
  set status = case when p_sender_type = 'customer' then 'open' else 'waiting_customer' end,
      last_message_at = v_now,
      last_message_preview = v_preview,
      updated_at = v_now
  where id = p_conversation_id;

  if v_unread_count = 0 then
    insert into public.support_email_notifications (
      conversation_id, message_id, recipient_type, recipient_email,
      recipient_name, status, next_attempt_at
    ) values (
      p_conversation_id, v_message_id, v_recipient_type, lower(btrim(p_recipient_email)),
      nullif(btrim(coalesce(p_recipient_name, '')), ''), 'pending', v_now
    )
    on conflict (message_id, recipient_type) do nothing
    returning id into v_notification_id;
  end if;

  return jsonb_build_object(
    'message_id', v_message_id,
    'notification_id', v_notification_id,
    'notification_queued', v_notification_id is not null
  );
end;
$$;

revoke all on function public.support_send_message(uuid, text, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.support_send_message(uuid, text, uuid, text, text, text) to service_role;
