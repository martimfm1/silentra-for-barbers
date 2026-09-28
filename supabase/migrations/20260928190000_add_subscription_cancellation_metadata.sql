-- Preserve who cancelled a subscription and when Stripe marked it as cancelled.
-- The Stripe webhook remains the source of truth for the cancellation timestamp.

alter table public.subscriptions
  add column if not exists canceled_at timestamptz,
  add column if not exists canceled_by_user_id uuid references auth.users(id) on delete set null;

create index if not exists subscriptions_canceled_by_user_idx
  on public.subscriptions (canceled_by_user_id);
