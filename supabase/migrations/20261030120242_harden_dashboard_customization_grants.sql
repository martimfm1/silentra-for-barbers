begin;

revoke all on public.barbershop_dashboard_customizations from anon;
revoke all on public.barbershop_dashboard_customizations from authenticated;

grant select, insert, update, delete
  on public.barbershop_dashboard_customizations
  to authenticated;

grant all
  on public.barbershop_dashboard_customizations
  to service_role;

commit;
