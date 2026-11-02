-- Keep loyalty rules, campaign rewards and POS line items linked to their original services.
alter table public.loyalty_earning_rules
  drop constraint if exists loyalty_earning_rules_service_id_fkey;

alter table public.loyalty_earning_rules
  add constraint loyalty_earning_rules_service_id_fkey
  foreign key (service_id)
  references public.services(id)
  on delete restrict
  not valid;

alter table public.loyalty_earning_rules
  validate constraint loyalty_earning_rules_service_id_fkey;

alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_birthday_reward_service_fkey;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_birthday_reward_service_fkey
  foreign key (birthday_reward_service_id)
  references public.services(id)
  on delete restrict
  not valid;

alter table public.marketing_campaigns
  validate constraint marketing_campaigns_birthday_reward_service_fkey;

alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_birthday_reward_service_id_fkey;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_birthday_reward_service_id_fkey
  foreign key (birthday_reward_service_id)
  references public.services(id)
  on delete restrict
  not valid;

alter table public.marketing_campaigns
  validate constraint marketing_campaigns_birthday_reward_service_id_fkey;

alter table public.pos_transaction_items
  drop constraint if exists pos_transaction_items_service_id_fkey;

alter table public.pos_transaction_items
  add constraint pos_transaction_items_service_id_fkey
  foreign key (service_id)
  references public.services(id)
  on delete restrict
  not valid;

alter table public.pos_transaction_items
  validate constraint pos_transaction_items_service_id_fkey;
