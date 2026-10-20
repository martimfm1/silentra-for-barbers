-- Enforce plan-based support ticket quotas and distinguish resolved vs unresolved closure.
-- "closed" remains the legacy resolved status for backwards compatibility.
alter table public.support_conversations
  drop constraint if exists support_conversations_status_check;

alter table public.support_conversations
  add constraint support_conversations_status_check
  check (status in ('pending', 'open', 'waiting_customer', 'closed', 'closed_unresolved'));

create index if not exists support_conversations_active_shop_idx
  on public.support_conversations (barbershop_id, created_at desc)
  where status in ('pending', 'open', 'waiting_customer');

comment on column public.support_conversations.status is
  'pending = awaiting admin acceptance; open/waiting_customer = active ticket; closed = resolved; closed_unresolved = closed without resolution.';

create or replace function public.enforce_support_ticket_open_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_assignment_plan text;
  v_subscription_plan text;
  v_plan_override text;
  v_subscription_status text;
  v_effective_plan text := 'free';
  v_limit integer;
  v_active_count integer;
  v_exclude_current boolean := false;
begin
  if tg_op = 'UPDATE' then
    -- Only re-check quota when a ticket becomes active or changes tenant.
    if new.status not in ('pending', 'open', 'waiting_customer')
       or (
         old.status in ('pending', 'open', 'waiting_customer')
         and new.barbershop_id = old.barbershop_id
       ) then
      return new;
    end if;
    v_exclude_current := true;
  elsif new.status not in ('pending', 'open', 'waiting_customer') then
    return new;
  end if;

  -- Serialize ticket creation/reactivation for a single barbershop. The API's
  -- preflight count is for UX only; this transaction lock is the enforcement.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.barbershop_id::text, 0)
  );

  select assignment.plan::text
    into v_assignment_plan
  from public.barbershop_plan_assignments as assignment
  where assignment.barbershop_id = new.barbershop_id
    and (assignment.expires_at is null or assignment.expires_at > pg_catalog.now())
  limit 1;

  select subscription.plan::text, subscription.plan_override, subscription.status::text
    into v_subscription_plan, v_plan_override, v_subscription_status
  from public.subscriptions as subscription
  where subscription.barbershop_id = new.barbershop_id
  order by subscription.updated_at desc
  limit 1;

  if v_assignment_plan is not null then
    v_effective_plan := v_assignment_plan;
  elsif v_plan_override is not null then
    v_effective_plan := v_plan_override;
  elsif v_subscription_status in ('active', 'trialing')
        and v_subscription_plan in ('pro', 'enterprise') then
    v_effective_plan := v_subscription_plan;
  end if;

  v_limit := case v_effective_plan
    when 'enterprise' then 10
    when 'pro' then 2
    when 'free' then 1
    else 1
  end;

  select pg_catalog.count(*)::integer
    into v_active_count
  from public.support_conversations as ticket
  where ticket.barbershop_id = new.barbershop_id
    and ticket.status in ('pending', 'open', 'waiting_customer')
    and (not v_exclude_current or ticket.id <> new.id);

  if v_active_count >= v_limit then
    raise exception using
      message = 'SUPPORT_TICKET_LIMIT_REACHED',
      errcode = 'P0001',
      detail = pg_catalog.format('plan=%s;limit=%s', v_effective_plan, v_limit);
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_support_ticket_open_limit() from public, anon, authenticated;

drop trigger if exists support_ticket_open_limit_guard on public.support_conversations;
create trigger support_ticket_open_limit_guard
  before insert or update of status, barbershop_id
  on public.support_conversations
  for each row
  execute function public.enforce_support_ticket_open_limit();

-- Defense in depth: no sender, including service_role RPC callers, can add
-- messages while a ticket awaits acceptance or after it has been closed.
create or replace function public.guard_support_message_ticket_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select ticket.status
    into v_status
  from public.support_conversations as ticket
  where ticket.id = new.conversation_id
  for update;

  if not found then
    raise exception using message = 'SUPPORT_TICKET_NOT_FOUND', errcode = 'P0002';
  end if;
  if v_status = 'pending' then
    raise exception using message = 'SUPPORT_TICKET_NOT_ACCEPTED', errcode = '22023';
  end if;
  if v_status in ('closed', 'closed_unresolved') then
    raise exception using message = 'SUPPORT_TICKET_CLOSED', errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_support_message_ticket_state() from public, anon, authenticated;

drop trigger if exists support_message_ticket_state_guard on public.support_messages;
create trigger support_message_ticket_state_guard
  before insert on public.support_messages
  for each row
  execute function public.guard_support_message_ticket_state();
