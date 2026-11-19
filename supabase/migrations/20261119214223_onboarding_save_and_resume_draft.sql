begin;

create table if not exists public.onboarding_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  draft jsonb not null,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  constraint onboarding_drafts_payload_is_object
    check (jsonb_typeof(draft) = 'object'),
  constraint onboarding_drafts_expiry_after_update
    check (expires_at > updated_at)
);

create index if not exists onboarding_drafts_expires_at_idx
  on public.onboarding_drafts (expires_at);

alter table public.onboarding_drafts enable row level security;

revoke all on table public.onboarding_drafts from public, anon;
grant select, insert, update, delete on table public.onboarding_drafts
  to authenticated;

drop policy if exists onboarding_drafts_owner_access
  on public.onboarding_drafts;

create policy onboarding_drafts_owner_access
  on public.onboarding_drafts
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

comment on table public.onboarding_drafts is
  'Private, user-scoped, expiring drafts for the pre-creation barbershop onboarding flow.';

notify pgrst, 'reload schema';
commit;