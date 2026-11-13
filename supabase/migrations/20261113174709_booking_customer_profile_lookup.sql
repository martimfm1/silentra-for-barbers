begin;

-- Match public booking customers using one identifier at a time. The function
-- returns a row only when exactly one client matches inside the selected shop.
create or replace function public.lookup_public_booking_customer(
  p_barbershop_id uuid,
  p_email text default null,
  p_phone text default null
)
returns table (
  customer_id uuid,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_birth_date date
)
language sql
stable
security invoker
set search_path = ''
as $function$
  with raw_input as (
    select
      nullif(lower(trim(coalesce(p_email, ''))), '') as email,
      regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as phone_digits
  ),
  input_without_international_prefix as (
    select
      email,
      case
        when left(phone_digits, 2) = '00' then substring(phone_digits from 3)
        else phone_digits
      end as phone_digits
    from raw_input
  ),
  lookup_values as (
    select
      email,
      case
        when left(phone_digits, 3) = '351' and length(phone_digits) = 12
          then substring(phone_digits from 4)
        else phone_digits
      end as phone
    from input_without_international_prefix
  ),
  raw_customers as (
    select
      u.id,
      nullif(trim(coalesce(u.name_complete, '')), '') as name,
      nullif(trim(coalesce(u.email, '')), '') as email,
      coalesce(u.birth_date, null)::date as birth_date,
      regexp_replace(coalesce(u.num_phone, ''), '[^0-9]', '', 'g') as phone_digits
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
  ),
  customers_without_international_prefix as (
    select
      id,
      name,
      email,
      birth_date,
      case
        when left(phone_digits, 2) = '00' then substring(phone_digits from 3)
        else phone_digits
      end as phone_digits
    from raw_customers
  ),
  normalized_customers as (
    select
      id,
      name,
      email,
      birth_date,
      case
        when left(phone_digits, 3) = '351' and length(phone_digits) = 12
          then substring(phone_digits from 4)
        else phone_digits
      end as phone
    from customers_without_international_prefix
  ),
  matches as (
    select
      customer.id,
      customer.name,
      customer.email,
      customer.phone,
      customer.birth_date
    from normalized_customers customer
    cross join lookup_values input
    where
      (input.email is not null and input.phone = '' and lower(customer.email) = input.email)
      or
      (input.email is null and length(input.phone) >= 7 and customer.phone = input.phone)
  )
  select
    match.id,
    match.name,
    match.email,
    match.phone,
    match.birth_date
  from matches match
  where (select count(*) from matches) = 1
  limit 1;
$function$;

revoke all on function public.lookup_public_booking_customer(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.lookup_public_booking_customer(uuid, text, text)
  to service_role;

comment on function public.lookup_public_booking_customer(uuid, text, text) is
  'Returns a unique public booking customer match by email or normalized phone, scoped to one barbershop. Only service_role can execute it.';

notify pgrst, 'reload schema';

commit;
