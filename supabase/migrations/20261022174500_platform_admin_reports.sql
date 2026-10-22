begin;

create or replace function public.get_platform_admin_reports(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(7, least(coalesce(p_days, 30), 90));
  v_start timestamptz;
  v_result jsonb;
begin
  v_start := date_trunc('day', now()) - make_interval(days => v_days - 1);

  select jsonb_build_object(
    'generatedAt', now(),
    'days', v_days,
    'totals', jsonb_build_object(
      'barbershops', (select count(*) from public.barbershops),
      'users', (select count(*) from public.users),
      'appointments', (select count(*) from public.appointments),
      'subscriptions', (select count(*) from public.subscriptions),
      'activeSubscriptions', (select count(*) from public.subscriptions where status::text in ('active', 'trialing')),
      'marketplaceOrders', (select count(*) from public.marketplace_orders)
    ),
    'period', jsonb_build_object(
      'newBarbershops', (select count(*) from public.barbershops where created_at >= v_start),
      'newUsers', (select count(*) from public.users where created_at >= v_start),
      'appointments', (select count(*) from public.appointments where created_at >= v_start),
      'completedAppointments', (select count(*) from public.appointments where created_at >= v_start and status::text = 'completed'),
      'cancelledAppointments', (select count(*) from public.appointments where created_at >= v_start and status::text in ('cancelled', 'canceled')),
      'paidSubscriptionRequests', (select count(*) from public.subscription_requests where status = 'PAID' and paid_at >= v_start),
      'subscriptionRevenue', coalesce((select sum(price) from public.subscription_requests where status = 'PAID' and paid_at >= v_start), 0),
      'posRevenue', coalesce((select sum(total) from public.pos_transactions where created_at >= v_start and status::text in ('completed', 'paid')), 0),
      'posTransactions', (select count(*) from public.pos_transactions where created_at >= v_start and status::text in ('completed', 'paid')),
      'marketplaceOrders', (select count(*) from public.marketplace_orders where created_at >= v_start),
      'marketplaceRevenue', coalesce((select sum(total) from public.marketplace_orders where created_at >= v_start and status::text not in ('cancelled', 'canceled', 'rejected', 'refunded')), 0),
      'apiRequests', (select count(*) from public.platform_api_logs where created_at >= v_start),
      'apiErrors', (select count(*) from public.platform_api_logs where created_at >= v_start and status_code >= 500),
      'marketingSent', (select count(*) from public.marketing_campaign_recipients where sent_at >= v_start),
      'marketingFailed', (select count(*) from public.marketing_campaign_recipients where created_at >= v_start and status = 'failed'),
      'automationRuns', (select count(*) from public.automation_runs where created_at >= v_start),
      'automationFailed', (select count(*) from public.automation_runs where created_at >= v_start and status = 'failed'),
      'openSupportConversations', (select count(*) from public.support_conversations where status::text not in ('closed', 'resolved'))
    ),
    'appointmentStatuses', (
      select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select status::text as status, count(*) as count
        from public.appointments
        where created_at >= v_start
        group by status::text
      ) appointment_status
    ),
    'subscriptionStatuses', (
      select coalesce(jsonb_agg(jsonb_build_object('status', status, 'count', count) order by count desc), '[]'::jsonb)
      from (
        select status::text as status, count(*) as count
        from public.subscriptions
        group by status::text
      ) subscription_status
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'date', to_char(day, 'YYYY-MM-DD'),
        'barbershops', coalesce(shop_counts.total, 0),
        'users', coalesce(user_counts.total, 0),
        'appointments', coalesce(appointment_counts.total, 0),
        'revenue', coalesce(revenue_counts.total, 0),
        'apiRequests', coalesce(api_counts.total, 0),
        'apiErrors', coalesce(api_counts.errors, 0)
      ) order by day), '[]'::jsonb)
      from generate_series(v_start::date, current_date, interval '1 day') as days(day)
      left join lateral (
        select count(*) as total from public.barbershops s
        where s.created_at >= day and s.created_at < day + interval '1 day'
      ) shop_counts on true
      left join lateral (
        select count(*) as total from public.users u
        where u.created_at >= day and u.created_at < day + interval '1 day'
      ) user_counts on true
      left join lateral (
        select count(*) as total from public.appointments a
        where a.created_at >= day and a.created_at < day + interval '1 day'
      ) appointment_counts on true
      left join lateral (
        select
          coalesce((select sum(sr.price) from public.subscription_requests sr
            where sr.status = 'PAID' and sr.paid_at >= day and sr.paid_at < day + interval '1 day'), 0)
          + coalesce((select sum(pt.total) from public.pos_transactions pt
            where pt.status::text in ('completed', 'paid') and pt.created_at >= day and pt.created_at < day + interval '1 day'), 0)
          as total
      ) revenue_counts on true
      left join lateral (
        select count(*) as total, count(*) filter (where l.status_code >= 500) as errors
        from public.platform_api_logs l
        where l.created_at >= day and l.created_at < day + interval '1 day'
      ) api_counts on true
    ),
    'recentActivity', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'action', action,
        'entityType', entity_type,
        'createdAt', created_at,
        'metadata', jsonb_build_object(
          'barbershop_id', metadata->>'barbershop_id',
          'plan', metadata->>'plan',
          'request_type', metadata->>'request_type'
        )
      ) order by created_at desc), '[]'::jsonb)
      from (
        select action, entity_type, created_at, metadata
        from public.audit_logs
        order by created_at desc
        limit 20
      ) audit
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_platform_admin_reports(integer) from public, anon, authenticated;
grant execute on function public.get_platform_admin_reports(integer) to service_role;

commit;
