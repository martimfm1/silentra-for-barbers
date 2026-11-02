-- Allow barbershops to archive services without deleting booking history.
alter table public.services
  add column if not exists is_active boolean not null default true;

create index if not exists services_active_by_barbershop_idx
  on public.services (barbershop_id, name)
  where is_active = true;

do $
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_price_non_negative'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_price_non_negative check (price >= 0) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'services_duration_valid'
      and conrelid = 'public.services'::regclass
  ) then
    alter table public.services
      add constraint services_duration_valid check (duration between 1 and 1440) not valid;
  end if;
end;
$;

-- Lightweight CRM metrics for the currently paginated client list.
create or replace function public.get_client_crm_metrics(
  p_barbershop_id uuid,
  p_client_ids uuid[]
)
returns table (
  client_id uuid,
  appointment_count bigint,
  total_spent numeric,
  last_visit timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.client_id,
    count(*) filter (where a.status = 'completed')::bigint as appointment_count,
    coalesce(
      sum(coalesce(a.service_price, 0) + coalesce(a.value_products, 0))
        filter (where a.status = 'completed'),
      0
    )::numeric(12,2) as total_spent,
    max(a.date_hour) filter (where a.status = 'completed') as last_visit
  from public.appointments a
  where a.barbershop_id = p_barbershop_id
    and a.client_id = any(coalesce(p_client_ids, '{}'::uuid[]))
    and a.status = 'completed'
  group by a.client_id;
$$;

revoke all on function public.get_client_crm_metrics(uuid, uuid[]) from public;
revoke all on function public.get_client_crm_metrics(uuid, uuid[]) from anon;
revoke all on function public.get_client_crm_metrics(uuid, uuid[]) from authenticated;
grant execute on function public.get_client_crm_metrics(uuid, uuid[]) to service_role;


-- Return one tenant-scoped, paginated CRM page with globally correct metric sorting.
create or replace function public.get_crm_clients_page(
  p_barbershop_id uuid,
  p_search text default '',
  p_sort text default 'recent',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  client_id uuid,
  name_complete text,
  name text,
  email text,
  num_phone text,
  birth_date text,
  style_notes text,
  created_at timestamptz,
  appointment_count bigint,
  total_spent numeric,
  last_visit timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with client_rows as (
    select
      u.id,
      u.name_complete::text as name_complete,
      u.name::text as name,
      u.email::text as email,
      u.num_phone::text as num_phone,
      u.birth_date::text as birth_date,
      u.style_notes::text as style_notes,
      u.created_at
    from public.users u
    where u.barbershop_id = p_barbershop_id
      and u.role = 'client'
      and (
        coalesce(trim(p_search), '') = ''
        or position(lower(trim(p_search)) in lower(concat_ws(' ', u.name_complete, u.name, u.email, u.num_phone))) > 0
      )
  ),
  metrics as (
    select
      a.client_id,
      count(*)::bigint as appointment_count,
      coalesce(sum(coalesce(a.service_price, 0) + coalesce(a.value_products, 0)), 0)::numeric(12,2) as total_spent,
      max(a.date_hour) as last_visit
    from public.appointments a
    where a.barbershop_id = p_barbershop_id
      and a.status = 'completed'
      and a.client_id in (select id from client_rows)
    group by a.client_id
  )
  select
    c.id,
    c.name_complete,
    c.name,
    c.email,
    c.num_phone,
    c.birth_date,
    c.style_notes,
    c.created_at,
    coalesce(m.appointment_count, 0)::bigint,
    coalesce(m.total_spent, 0)::numeric(12,2),
    m.last_visit
  from client_rows c
  left join metrics m on m.client_id = c.id
  order by
    case when p_sort = 'visits' then coalesce(m.appointment_count, 0) end desc nulls last,
    case when p_sort = 'spent' then coalesce(m.total_spent, 0) end desc nulls last,
    case when p_sort = 'name' then lower(c.name_complete) end asc nulls last,
    case when p_sort = 'recent' or p_sort not in ('name', 'visits', 'spent') then c.created_at end desc nulls last,
    c.id
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(0, coalesce(p_offset, 0));
$$;

revoke all on function public.get_crm_clients_page(uuid, text, text, integer, integer) from public;
revoke all on function public.get_crm_clients_page(uuid, text, text, integer, integer) from anon;
revoke all on function public.get_crm_clients_page(uuid, text, text, integer, integer) from authenticated;
grant execute on function public.get_crm_clients_page(uuid, text, text, integer, integer) to service_role;
