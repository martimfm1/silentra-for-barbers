begin;

create table if not exists public.marketing_contact_preferences (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  client_id uuid references public.users(id) on delete set null,
  email text not null,
  email_consent_at timestamptz,
  email_consent_source text,
  email_unsubscribed_at timestamptz,
  email_preference_updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_contact_preferences_email_check
    check (email = lower(trim(email)) and char_length(email) between 3 and 254),
  constraint marketing_contact_preferences_source_check
    check (email_consent_source is null or char_length(email_consent_source) <= 80),
  unique (barbershop_id, email)
);

create index if not exists marketing_contact_preferences_eligible_idx
  on public.marketing_contact_preferences(barbershop_id, email)
  where email_consent_at is not null and email_unsubscribed_at is null;

alter table public.marketing_contact_preferences enable row level security;
revoke all on table public.marketing_contact_preferences from anon, authenticated;
grant select, insert, update, delete
  on table public.marketing_contact_preferences to service_role;

create table if not exists public.marketing_campaign_monthly_usage (
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  usage_month date not null,
  manual_campaigns_sent integer not null default 0 check (manual_campaigns_sent >= 0),
  updated_at timestamptz not null default now(),
  primary key (barbershop_id, usage_month)
);
alter table public.marketing_campaign_monthly_usage enable row level security;
revoke all on table public.marketing_campaign_monthly_usage from anon, authenticated;
grant select, insert, update, delete
  on table public.marketing_campaign_monthly_usage to service_role;

create or replace function public.reserve_marketing_campaign_send(
  p_barbershop_id uuid, p_usage_month date, p_limit integer
)
returns boolean language plpgsql security invoker set search_path = public as $$
declare
  reserved boolean;
begin
  if p_limit < 1 then return false; end if;
  insert into public.marketing_campaign_monthly_usage
    (barbershop_id, usage_month, manual_campaigns_sent, updated_at)
  values (p_barbershop_id, p_usage_month, 1, now())
  on conflict (barbershop_id, usage_month)
  do update set
    manual_campaigns_sent = public.marketing_campaign_monthly_usage.manual_campaigns_sent + 1,
    updated_at = now()
  where public.marketing_campaign_monthly_usage.manual_campaigns_sent < p_limit
  returning true into reserved;
  return coalesce(reserved, false);
end;
$$;

create or replace function public.release_marketing_campaign_send(
  p_barbershop_id uuid, p_usage_month date
)
returns void language sql security invoker set search_path = public as $$
  update public.marketing_campaign_monthly_usage
  set manual_campaigns_sent = greatest(manual_campaigns_sent - 1, 0), updated_at = now()
  where barbershop_id = p_barbershop_id and usage_month = p_usage_month;
$$;

revoke all on function public.reserve_marketing_campaign_send(uuid, date, integer) from public, anon, authenticated;
revoke all on function public.release_marketing_campaign_send(uuid, date) from public, anon, authenticated;
grant execute on function public.reserve_marketing_campaign_send(uuid, date, integer) to service_role;
grant execute on function public.release_marketing_campaign_send(uuid, date) to service_role;

comment on table public.marketing_contact_preferences is
  'Tenant-scoped explicit marketing permissions and unsubscribe state. Existing contacts are not opted in automatically.';


alter table public.marketing_campaigns
  add column if not exists birthday_processing_started_at timestamptz;

-- Recover incomplete birthday runs from the legacy worker, which could mark a
-- cycle as consumed before all queued recipients had been delivered.
update public.marketing_campaigns as campaign
set birthday_last_run_date = null,
    birthday_processing_started_at = null,
    status = case when campaign.status = 'completed' then 'scheduled' else campaign.status end,
    completed_at = null,
    updated_at = now()
where campaign.trigger_type = 'birthday'
  and campaign.birthday_last_run_date is not null
  and exists (
    select 1
    from public.marketing_campaign_recipients as recipient
    where recipient.campaign_id = campaign.id
      and recipient.run_key = 'birthday:' || campaign.birthday_last_run_date::text
      and recipient.status = 'failed'
  );

create or replace function public.claim_birthday_marketing_campaign(
  p_campaign_id uuid,
  p_today date,
  p_now timestamptz
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  claimed boolean;
begin
  update public.marketing_campaigns
  set birthday_processing_started_at = p_now,
      updated_at = p_now
  where id = p_campaign_id
    and trigger_type = 'birthday'
    and active = true
    and status <> 'cancelled'
    and birthday_last_run_date is distinct from p_today
    and (
      birthday_processing_started_at is null
      or birthday_processing_started_at < p_now - interval '2 hours'
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_birthday_marketing_campaign(uuid, date, timestamptz)
  from public, anon, authenticated;
grant execute on function public.claim_birthday_marketing_campaign(uuid, date, timestamptz)
  to service_role;


commit;
