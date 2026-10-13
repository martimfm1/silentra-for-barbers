-- Store only a one-way hash of customer order-tracking capabilities.
-- The raw token is returned once to the customer and is never persisted.
alter table public.marketplace_orders
  add column if not exists tracking_token_hash text;

create unique index if not exists marketplace_orders_tracking_token_hash_uidx
  on public.marketplace_orders(tracking_token_hash)
  where tracking_token_hash is not null;
