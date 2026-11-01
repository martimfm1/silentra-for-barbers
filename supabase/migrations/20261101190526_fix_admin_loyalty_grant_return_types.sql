begin;

-- Keep the service-role-only grant-by-email RPC's declared result contract
-- aligned with the underlying barbershops.name varchar column.
create or replace function public.admin_grant_loyalty_points_by_email(
  p_email text,
  p_points integer,
  p_reason text default null
)
returns table (
  member_id uuid,
  member_email text,
  barbershop_id uuid,
  barbershop_name text,
  previous_balance integer,
  points_added integer,
  new_balance integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_member public.loyalty_members;
  v_shop public.barbershops;
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  v_reason text := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_reason, '')), 500), '');
  v_previous integer;
  v_new integer;
begin
  if v_email = '' or length(v_email) > 254 then
    raise exception 'LOYALTY_EMAIL_INVALID' using errcode = '22023';
  end if;
  if p_points is null or p_points <= 0 or p_points > 1000000 then
    raise exception 'LOYALTY_POINTS_INVALID' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'LOYALTY_REASON_REQUIRED' using errcode = '22023';
  end if;

  select lm.*
  into v_member
  from public.loyalty_members as lm
  where pg_catalog.lower(lm.email) = v_email
    and lm.status = 'active'
  order by lm.updated_at desc
  limit 1
  for update;

  if not found then
    raise exception 'LOYALTY_MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  select b.*
  into v_shop
  from public.barbershops as b
  where b.id = v_member.barbershop_id;

  if not found then
    raise exception 'LOYALTY_BARBERSHOP_NOT_FOUND';
  end if;

  v_previous := v_member.points_balance;
  v_new := v_previous + p_points;

  update public.loyalty_members as lm
  set points_balance = v_new,
      updated_at = now()
  where lm.id = v_member.id;

  insert into public.loyalty_member_transactions (
    barbershop_id,
    member_id,
    points,
    type,
    description
  )
  values (
    v_member.barbershop_id,
    v_member.id,
    p_points,
    'adjustment',
    'Admin: ' || v_reason
  );

  perform public.sync_loyalty_legacy_account(v_member.id);

  return query
  select
    v_member.id::uuid,
    v_member.email::text,
    v_member.barbershop_id::uuid,
    v_shop.name::text,
    v_previous::integer,
    p_points::integer,
    v_new::integer;
end;
$function$;

revoke all on function public.admin_grant_loyalty_points_by_email(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.admin_grant_loyalty_points_by_email(text, integer, text)
  to service_role;

notify pgrst, 'reload schema';

commit;
