begin;

-- A single order may have multiple tracking links (receipt plus future status
-- notifications). Store only SHA-256 hashes; the plaintext token is emitted
-- once and kept only in the email/response flow.
create table if not exists public.marketplace_order_tracking_tokens (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);

create index if not exists marketplace_order_tracking_tokens_order_idx
  on public.marketplace_order_tracking_tokens(order_id, created_at desc);

alter table public.marketplace_order_tracking_tokens enable row level security;

-- This table contains bearer credentials and is server-only.
revoke all on table public.marketplace_order_tracking_tokens
  from public, anon, authenticated;
grant select, insert, update, delete on table public.marketplace_order_tracking_tokens
  to service_role;

-- Preserve all tracking links that were issued before this table existed.
insert into public.marketplace_order_tracking_tokens (
  order_id,
  token_hash,
  created_at
)
select
  id,
  tracking_token_hash,
  coalesce(created_at, now())
from public.marketplace_orders
where tracking_token_hash is not null
  and tracking_token_hash ~ '^[a-f0-9]{64}$'
on conflict (token_hash) do nothing;

comment on table public.marketplace_order_tracking_tokens is
  'Private tracking capabilities for marketplace orders. Only token hashes are persisted; service-role access only.';
comment on column public.marketplace_order_tracking_tokens.token_hash is
  'SHA-256 hash of a random 256-bit bearer token. Never store the raw capability.';
comment on column public.marketplace_order_tracking_tokens.revoked_at is
  'When set, the token is no longer valid even if a legacy hash is present.';

commit;
