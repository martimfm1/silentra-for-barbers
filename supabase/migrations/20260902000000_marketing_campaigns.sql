create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  channel text not null check (channel in ('email', 'sms')),
  subject text,
  body text not null check (char_length(body) between 1 and 10000),
  segment jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','completed','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_email_subject check (channel <> 'email' or (subject is not null and char_length(subject) between 1 and 200))
);

create table if not exists public.marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  client_id uuid not null references public.users(id) on delete cascade,
  destination text not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','delivered','failed','skipped')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, client_id)
);

create index if not exists marketing_campaigns_tenant_created_idx on public.marketing_campaigns(barbershop_id, created_at desc);
create index if not exists marketing_campaign_recipients_campaign_idx on public.marketing_campaign_recipients(campaign_id, status);

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_recipients enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketing_campaigns'
      and policyname = 'marketing_campaigns_staff_read'
  ) then
    create policy "marketing_campaigns_staff_read" on public.marketing_campaigns
      for select to authenticated
      using (barbershop_id = get_my_barbershop_id()::uuid);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketing_campaigns'
      and policyname = 'marketing_campaigns_staff_insert'
  ) then
    create policy "marketing_campaigns_staff_insert" on public.marketing_campaigns
      for insert to authenticated
      with check (
        barbershop_id = get_my_barbershop_id()::uuid
        and created_by = auth.uid()
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketing_campaigns'
      and policyname = 'marketing_campaigns_staff_update'
  ) then
    create policy "marketing_campaigns_staff_update" on public.marketing_campaigns
      for update to authenticated
      using (barbershop_id = get_my_barbershop_id()::uuid)
      with check (barbershop_id = get_my_barbershop_id()::uuid);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'marketing_campaign_recipients'
      and policyname = 'marketing_campaign_recipients_staff_read'
  ) then
    create policy "marketing_campaign_recipients_staff_read" on public.marketing_campaign_recipients
      for select to authenticated
      using (exists (
        select 1 from public.marketing_campaigns c
        where c.id = campaign_id and c.barbershop_id = get_my_barbershop_id()::uuid
      ));
  end if;
end
$$;

-- Recipient rows are server-managed. Browser clients cannot enqueue arbitrary recipients.
comment on table public.marketing_campaign_recipients is 'Server-managed delivery state for marketing campaigns.';
