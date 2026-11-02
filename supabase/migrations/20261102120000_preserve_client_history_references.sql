-- Do not cascade-delete client booking, financial, loyalty, marketing or support history.
alter table public.appointments
  drop constraint if exists fk_appointments_user;

alter table public.appointments
  add constraint fk_appointments_user
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.appointments
  validate constraint fk_appointments_user;

alter table public.birthday_email_logs
  drop constraint if exists birthday_email_logs_client_id_fkey;

alter table public.birthday_email_logs
  add constraint birthday_email_logs_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.birthday_email_logs
  validate constraint birthday_email_logs_client_id_fkey;

alter table public.client_notes
  drop constraint if exists client_notes_client_id_fkey;

alter table public.client_notes
  add constraint client_notes_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.client_notes
  validate constraint client_notes_client_id_fkey;

alter table public.client_plans
  drop constraint if exists client_plans_client_id_fkey;

alter table public.client_plans
  add constraint client_plans_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.client_plans
  validate constraint client_plans_client_id_fkey;

alter table public.loyalty_accounts
  drop constraint if exists loyalty_accounts_client_id_fkey;

alter table public.loyalty_accounts
  add constraint loyalty_accounts_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.loyalty_accounts
  validate constraint loyalty_accounts_client_id_fkey;

alter table public.loyalty_redemptions
  drop constraint if exists loyalty_redemptions_client_id_fkey;

alter table public.loyalty_redemptions
  add constraint loyalty_redemptions_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.loyalty_redemptions
  validate constraint loyalty_redemptions_client_id_fkey;

alter table public.loyalty_transactions
  drop constraint if exists loyalty_transactions_client_id_fkey;

alter table public.loyalty_transactions
  add constraint loyalty_transactions_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.loyalty_transactions
  validate constraint loyalty_transactions_client_id_fkey;

alter table public.marketing_campaign_recipients
  drop constraint if exists marketing_campaign_recipients_client_id_fkey;

alter table public.marketing_campaign_recipients
  add constraint marketing_campaign_recipients_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.marketing_campaign_recipients
  validate constraint marketing_campaign_recipients_client_id_fkey;

alter table public.marketing_campaign_vouchers
  drop constraint if exists marketing_campaign_vouchers_client_id_fkey;

alter table public.marketing_campaign_vouchers
  add constraint marketing_campaign_vouchers_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.marketing_campaign_vouchers
  validate constraint marketing_campaign_vouchers_client_id_fkey;

alter table public.support_conversations
  drop constraint if exists support_conversations_customer_user_id_fkey;

alter table public.support_conversations
  add constraint support_conversations_customer_user_id_fkey
  foreign key (customer_user_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.support_conversations
  validate constraint support_conversations_customer_user_id_fkey;
