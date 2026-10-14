alter table public.subscription_requests
  add column if not exists original_price numeric(10, 2),
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists promotion_code text;

update public.subscription_requests
set original_price = price
where original_price is null;

alter table public.subscription_requests
  alter column original_price set not null;

alter table public.subscription_requests
  add constraint subscription_requests_original_price_nonnegative
    check (original_price >= 0),
  add constraint subscription_requests_discount_amount_nonnegative
    check (discount_amount >= 0),
  add constraint subscription_requests_promotion_price_consistent
    check (
      price >= 0
      and price <= original_price
      and discount_amount = round(original_price - price, 2)
    ),
  add constraint subscription_requests_promotion_code_length
    check (promotion_code is null or length(promotion_code) <= 40);

comment on column public.subscription_requests.original_price is
  'Server-resolved manual plan price before a promotional discount, in EUR.';
comment on column public.subscription_requests.discount_amount is
  'Server-calculated promotional discount, in EUR.';
comment on column public.subscription_requests.promotion_code is
  'Normalized code validated against MANUAL_PROMO_CODES_JSON at checkout.';
