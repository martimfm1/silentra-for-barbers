-- Repair production schema drift: billing-summary reads this column and
-- cancellation flows persist the time the request was made.
alter table public.subscriptions
  add column if not exists cancellation_requested_at timestamptz;

create index if not exists subscriptions_cancellation_requested_at_idx
  on public.subscriptions (cancellation_requested_at);
