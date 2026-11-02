-- Allow barbershops to archive services without deleting booking history.
alter table public.services
  add column if not exists is_active boolean not null default true;

create index if not exists services_active_by_barbershop_idx
  on public.services (barbershop_id, name)
  where is_active = true;

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
