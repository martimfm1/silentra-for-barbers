-- Use the billing contact captured during manual checkout when generating the payment receipt.
-- Fall back to the authenticated account email for older requests created before this field existed.

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
  v_customer_name text;
  v_customer_email text;
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

  v_customer_name := coalesce(v_request.billing_name, v_user_name, v_user_email);
  v_customer_email := coalesce(v_request.billing_email, v_user_email);

  if v_customer_email is null then
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
    manual_request_id, subscription_id, user_id, barbershop_id,
    document_type, document_number, issued_at, customer_name, customer_email,
    barbershop_name, plan, billing_interval, payment_method, description,
    currency, subtotal, tax_amount, total,
    customer_tax_id, customer_phone, customer_address_line1, customer_address_line2,
    customer_postal_code, customer_city, customer_country, customer_website,
    seller_name, seller_website
  )
  values (
    v_request.id, v_subscription_id, v_request.user_id, v_request.barbershop_id,
    'PAYMENT_RECEIPT', v_number, coalesce(v_request.paid_at, pg_catalog.now()),
    v_customer_name, v_customer_email, v_shop_name, v_request.plan,
    v_request.billing_interval, 'MANUAL',
    'Subscrição Silentra for Barbers — ' || initcap(v_request.plan::text) ||
      ' (' || v_request.billing_interval || ')',
    v_request.currency, v_request.price, 0, v_request.price,
    v_request.tax_id, v_request.phone, v_request.address_line1, v_request.address_line2,
    v_request.postal_code, v_request.city, v_request.country, v_request.website,
    'Silentra', 'https://silentra.me'
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
