-- Cover the new RESTRICT foreign keys and common tenant-scoped CRM history lookups.
create index if not exists birthday_email_logs_client_fk_idx
  on public.birthday_email_logs (client_id);

create index if not exists client_notes_client_fk_idx
  on public.client_notes (client_id);

create index if not exists client_plans_client_fk_idx
  on public.client_plans (client_id);

create index if not exists loyalty_accounts_client_fk_idx
  on public.loyalty_accounts (client_id);

create index if not exists loyalty_redemptions_client_fk_idx
  on public.loyalty_redemptions (client_id);

create index if not exists loyalty_transactions_client_fk_idx
  on public.loyalty_transactions (client_id);

create index if not exists marketing_campaign_recipients_client_fk_idx
  on public.marketing_campaign_recipients (client_id);

create index if not exists marketing_campaign_vouchers_client_fk_idx
  on public.marketing_campaign_vouchers (client_id);

create index if not exists loyalty_earning_rules_service_fk_idx
  on public.loyalty_earning_rules (service_id);

create index if not exists marketing_campaign_vouchers_service_fk_idx
  on public.marketing_campaign_vouchers (service_id);

create index if not exists marketing_campaigns_birthday_service_fk_idx
  on public.marketing_campaigns (birthday_reward_service_id);

create index if not exists pos_transaction_items_service_fk_idx
  on public.pos_transaction_items (service_id);
