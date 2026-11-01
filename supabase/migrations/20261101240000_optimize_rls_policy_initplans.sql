begin;

-- Cache auth context once per statement instead of evaluating auth.uid()
-- for every row inspected by RLS.
drop policy if exists "Barbershop creators can insert marketplace shop" on public.shops;
create policy "Barbershop creators can insert marketplace shop"
on public.shops
for insert
to authenticated
with check (
  exists (
    select 1
    from public.barbershops as b
    where b.id = shops.barbershop_id
      and b.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.barbershop_id = shops.barbershop_id
      and u.role = any (array['owner'::text, 'admin'::text])
  )
);

drop policy if exists "Barbershop owners and admins can update marketplace shop" on public.shops;
create policy "Barbershop owners and admins can update marketplace shop"
on public.shops
for update
to authenticated
using (
  exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.barbershop_id = shops.barbershop_id
      and u.role = any (array['owner'::text, 'admin'::text])
  )
)
with check (
  exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.barbershop_id = shops.barbershop_id
      and u.role = any (array['owner'::text, 'admin'::text])
  )
);

drop policy if exists "Permitir delete de serviços da barbearia" on public.services;
create policy "Permitir delete de serviços da barbearia"
on public.services
for delete
to authenticated
using ((select public.get_my_barbershop_id()) = (barbershop_id)::text);

drop policy if exists "Permitir escrita de serviços da barbearia" on public.services;
create policy "Permitir escrita de serviços da barbearia"
on public.services
for insert
to authenticated
with check ((select public.get_my_barbershop_id()) = (barbershop_id)::text);

drop policy if exists "Permitir update de serviços da barbearia" on public.services;
create policy "Permitir update de serviços da barbearia"
on public.services
for update
to authenticated
using ((select public.get_my_barbershop_id()) = (barbershop_id)::text)
with check ((select public.get_my_barbershop_id()) = (barbershop_id)::text);

drop policy if exists marketing_campaigns_staff_read on public.marketing_campaigns;
create policy marketing_campaigns_staff_read
on public.marketing_campaigns
for select
to authenticated
using (barbershop_id = (select public.get_my_barbershop_id())::uuid);

drop policy if exists marketing_campaigns_staff_update on public.marketing_campaigns;
create policy marketing_campaigns_staff_update
on public.marketing_campaigns
for update
to authenticated
using (barbershop_id = (select public.get_my_barbershop_id())::uuid)
with check (barbershop_id = (select public.get_my_barbershop_id())::uuid);

drop policy if exists marketing_campaigns_staff_insert on public.marketing_campaigns;
create policy marketing_campaigns_staff_insert
on public.marketing_campaigns
for insert
to authenticated
with check (
  barbershop_id = (select public.get_my_barbershop_id())::uuid
  and created_by = (select auth.uid())
);

drop policy if exists "Users read their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users read their dashboard customizations"
on public.barbershop_dashboard_customizations
for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.barbershop_id = barbershop_dashboard_customizations.barbershop_id
      and u.role <> all (array['client'::text, 'customer'::text])
  )
);

drop policy if exists "Users create their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users create their dashboard customizations"
on public.barbershop_dashboard_customizations
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.barbershop_id = barbershop_dashboard_customizations.barbershop_id
      and u.role <> all (array['client'::text, 'customer'::text])
  )
);

drop policy if exists "Users update their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users update their dashboard customizations"
on public.barbershop_dashboard_customizations
for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.users as u
    where u.id = (select auth.uid())
      and u.barbershop_id = barbershop_dashboard_customizations.barbershop_id
      and u.role <> all (array['client'::text, 'customer'::text])
  )
);

drop policy if exists "Users delete their dashboard customizations" on public.barbershop_dashboard_customizations;
create policy "Users delete their dashboard customizations"
on public.barbershop_dashboard_customizations
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- Keep the exact existing access model: a user can read their own
-- subscription, and members can read the subscription for their shop.
-- Merge the two permissive SELECT policies to avoid duplicate evaluation.
drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists "Barbershop members can read their subscription" on public.subscriptions;
create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (
  user_id = (select auth.uid())
  or barbershop_id = (
    select u.barbershop_id
    from public.users as u
    where u.id = (select auth.uid())
  )
);

-- A public SELECT policy already grants both anon and authenticated access.
-- Remove redundant permissive policies without changing visibility.
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists "Leitura pública de serviços" on public.services;
drop policy if exists "Permitir leitura de serviços da barbearia" on public.services;

notify pgrst, 'reload schema';

commit;
