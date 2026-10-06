-- Automatic internal payment receipts for manual SaaS subscription payments.
-- These documents are payment proofs generated from confirmed manual subscription requests.
-- They are NOT Portuguese fiscal invoices/receipts and must not be presented as such.

create sequence if not exists public.manual_payment_document_number_seq;

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  manual_request_id uuid not null unique references public.subscription_requests(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid not null references public.users(id) on delete restrict,
  barbershop_id uuid not null references public.barbershops(id) on delete restrict,
  document_type text not null default 'PAYMENT_RECEIPT'
    check (document_type = 'PAYMENT_RECEIPT'),
  document_number text not null unique,
  issued_at timestamptz not null default now(),
  customer_name text not null,
  customer_email text not null,
  barbershop_name text not null,
  plan text not null,
  billing_interval text not null check (billing_interval in ('month','year')),
  payment_method text not null default 'MANUAL',
  description text not null,
  currency text not null default 'EUR',
  subtotal numeric(12,2) not null check (subtotal >= 0),
  tax_amount numeric(12,2) not null default 0 check (tax_amount >= 0),
  total numeric(12,2) not null check (total >= 0),
  pdf_generated_at timestamptz,
  email_sent_at timestamptz,
  email_message_id text,
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists billing_documents_user_idx
  on public.billing_documents (user_id, issued_at desc);

create index if not exists billing_documents_barbershop_idx
  on public.billing_documents (barbershop_id, issued_at desc);

alter table public.billing_documents enable row level security;

drop policy if exists "Users can read their billing documents"
  on public.billing_documents;

create policy "Users can read their billing documents"
  on public.billing_documents
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.billing_documents from anon, authenticated;
grant select on public.billing_documents to authenticated;

create or replace function public.touch_billing_documents_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists billing_documents_updated_at
  on public.billing_documents;

create trigger billing_documents_updated_at
before update on public.billing_documents
for each row execute function public.touch_billing_documents_updated_at();

create or replace function public.create_manual_payment_document(
  p_request_id uuid
)
returns public.billing_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.subscription_requests;
  v_document public.billing_documents;
  v_user_name text;
  v_user_email text;
  v_shop_name text;
  v_subscription_id uuid;
  v_number text;
begin
  if p_request_id is null then
    raise exception using errcode = '22023', message = 'INVALID_REQUEST_ID';
  end if;

  select *
    into v_request
  from public.subscription_requests as sr
  where sr.id = p_request_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'SUBSCRIPTION_REQUEST_NOT_FOUND';
  end if;

  if v_request.status <> 'PAID' or v_request.paid_at is null then
    raise exception using errcode = 'P0001', message = 'PAYMENT_NOT_CONFIRMED';
  end if;

  select bd.*
    into v_document
  from public.billing_documents as bd
  where bd.manual_request_id = p_request_id;

  if found then
    return v_document;
  end if;

  select u.name_complete, u.email
    into v_user_name, v_user_email
  from public.users as u
  where u.id = v_request.user_id;

  if v_user_email is null then
    raise exception using errcode = 'P0001', message = 'CUSTOMER_EMAIL_NOT_FOUND';
  end if;

  select b.name
    into v_shop_name
  from public.barbershops as b
  where b.id = v_request.barbershop_id;

  if v_shop_name is null then
    raise exception using errcode = 'P0001', message = 'BARBERSHOP_NOT_FOUND';
  end if;

  v_subscription_id := v_request.subscription_id;
  v_number := 'RC-' ||
    to_char(coalesce(v_request.paid_at, pg_catalog.now()), 'YYYY') ||
    '-' ||
    lpad(nextval('public.manual_payment_document_number_seq')::text, 6, '0');

  insert into public.billing_documents (
    manual_request_id,
    subscription_id,
    user_id,
    barbershop_id,
    document_type,
    document_number,
    issued_at,
    customer_name,
    customer_email,
    barbershop_name,
    plan,
    billing_interval,
    payment_method,
    description,
    currency,
    subtotal,
    tax_amount,
    total
  )
  values (
    v_request.id,
    v_subscription_id,
    v_request.user_id,
    v_request.barbershop_id,
    'PAYMENT_RECEIPT',
    v_number,
    coalesce(v_request.paid_at, pg_catalog.now()),
    coalesce(v_user_name, v_user_email),
    v_user_email,
    v_shop_name,
    v_request.plan,
    v_request.billing_interval,
    'MANUAL',
    'Subscrição Silentra for Barbers — ' || initcap(v_request.plan::text) ||
      ' (' || v_request.billing_interval || ')',
    v_request.currency,
    v_request.price,
    0,
    v_request.price
  )
  returning * into v_document;

  return v_document;
exception
  when unique_violation then
    select bd.*
      into v_document
    from public.billing_documents as bd
    where bd.manual_request_id = p_request_id;

    if found then
      return v_document;
    end if;
    raise;
end;
$$;

revoke all on function public.create_manual_payment_document(uuid)
  from public, anon, authenticated;
grant execute on function public.create_manual_payment_document(uuid)
  to service_role;

notify pgrst, 'reload schema';
