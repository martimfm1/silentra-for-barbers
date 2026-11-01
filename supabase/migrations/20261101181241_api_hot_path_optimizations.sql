-- Reduce API round trips on protected module routes and CRM client profiles.
-- All privileged RPCs are restricted to service_role and execute with a fixed search_path.

create index if not exists appointments_client_timeline_idx
  on public.appointments (barbershop_id, client_id, date_hour desc)
  include (status, service_price, value_products);

create or replace function public.get_client_completed_total_spent(
  p_barbershop_id uuid,
  p_client_id uuid
)
returns numeric
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(
    sum(coalesce(a.service_price, 0) + coalesce(a.value_products, 0)),
    0
  )::numeric
  from public.appointments as a
  where a.barbershop_id = p_barbershop_id
    and a.client_id = p_client_id
    and a.status = 'completed';
$function$;

revoke all on function public.get_client_completed_total_spent(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_client_completed_total_spent(uuid, uuid)
  to service_role;

create or replace function public.get_module_access_context(
  p_user_id uuid,
  p_permission_keys text[] default array[]::text[]
)
returns table (
  barbershop_id uuid,
  role text,
  plan text,
  permission_granted boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    u.barbershop_id,
    lower(coalesce(u.role::text, 'barber')) as role,
    case
      when u.barbershop_id is null then 'free'::text
      else coalesce(
        public.get_effective_billing_plan_for_barbershop(u.barbershop_id),
        'free'::text
      )
    end as plan,
    case
      when cardinality(coalesce(p_permission_keys, array[]::text[])) = 0
        then true
      when lower(coalesce(u.role::text, '')) = 'owner'
        then true
      when u.id is null or u.barbershop_id is null
        then false
      when member_grant.user_id is not null
        then exists (
          select 1
          from unnest(coalesce(p_permission_keys, array[]::text[]))
            as requested_permission(permission_key)
          where member_grant.permissions -> requested_permission.permission_key
            = 'true'::jsonb
        )
      else exists (
        select 1
        from public.staff_permissions as legacy_grant
        where legacy_grant.barbershop_id = u.barbershop_id
          and legacy_grant.user_id = u.id
          and legacy_grant.permission = any(
            coalesce(p_permission_keys, array[]::text[])
          )
          and legacy_grant.allowed is true
      )
    end as permission_granted
  from (values (p_user_id)) as requested_user(user_id)
  left join public.users as u
    on u.id = requested_user.user_id
  left join lateral (
    select member.user_id, member.permissions
    from public.barbershop_member_permissions as member
    where member.barbershop_id = u.barbershop_id
      and member.user_id = u.id
    limit 1
  ) as member_grant on true;
$function$;

revoke all on function public.get_module_access_context(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.get_module_access_context(uuid, text[])
  to service_role;

comment on function public.get_module_access_context(uuid, text[]) is
  'Single-read server-side module access context. Keeps plan resolution and canonical/legacy tenant permissions consistent; executable only by service_role.';
comment on function public.get_client_completed_total_spent(uuid, uuid) is
  'Returns the sum of completed appointment service and product amounts for one client in one barbershop; executable only by service_role.';

-- Make the new RPC signatures immediately available through PostgREST.
notify pgrst, 'reload schema';
