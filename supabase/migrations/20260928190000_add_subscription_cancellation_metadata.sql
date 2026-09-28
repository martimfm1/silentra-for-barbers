-- Persist the cancellation lifecycle separately from Stripe's live state.
-- This lets the dashboard show who requested the cancellation even after the
-- subscription reaches the terminal "canceled" state.

alter table public.subscriptions
  add column if not exists canceled_at timestamptz,
  add column if not exists canceled_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists cancellation_requested_at timestamptz;

create index if not exists subscriptions_canceled_by_user_idx
  on public.subscriptions (canceled_by_user_id);

create index if not exists subscriptions_canceled_at_idx
  on public.subscriptions (canceled_at);
