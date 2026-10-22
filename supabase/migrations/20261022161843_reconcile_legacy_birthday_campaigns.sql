begin;

-- The birthday settings screen now writes to marketing_campaigns. Older
-- installations can still have an enabled legacy row created after the
-- original migration ran, leaving the scheduler with no campaign to process.
-- Backfill only shops that do not already have any birthday campaign so we
-- never overwrite a newer campaign or re-enable a campaign a shop disabled.
insert into public.marketing_campaigns (
  barbershop_id,
  created_by,
  name,
  channel,
  subject,
  body,
  segment,
  status,
  trigger_type,
  birthday_offset_days,
  birthday_reward_type,
  active
)
select
  legacy.barbershop_id,
  shop.created_by,
  'Aniversários',
  'email',
  legacy.subject,
  legacy.body,
  '{}'::jsonb,
  'scheduled',
  'birthday',
  0,
  'none',
  true
from public.birthday_email_automations as legacy
join public.barbershops as shop
  on shop.id = legacy.barbershop_id
where legacy.enabled = true
  and exists (
    select 1
    from auth.users as owner
    where owner.id = shop.created_by
  )
  and not exists (
    select 1
    from public.marketing_campaigns as campaign
    where campaign.barbershop_id = legacy.barbershop_id
      and campaign.trigger_type = 'birthday'
  );

commit;
