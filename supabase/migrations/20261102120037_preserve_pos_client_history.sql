-- POS sales and automation outbox records must retain their customer reference.
alter table public.pos_transactions
  drop constraint if exists pos_transactions_client_id_fkey;

alter table public.pos_transactions
  add constraint pos_transactions_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.pos_transactions
  validate constraint pos_transactions_client_id_fkey;

alter table public.booking_automation_outbox
  drop constraint if exists booking_automation_outbox_client_id_fkey;

alter table public.booking_automation_outbox
  add constraint booking_automation_outbox_client_id_fkey
  foreign key (client_id)
  references public.users(id)
  on delete restrict
  not valid;

alter table public.booking_automation_outbox
  validate constraint booking_automation_outbox_client_id_fkey;

create index if not exists pos_transactions_client_fk_idx
  on public.pos_transactions (client_id);

create index if not exists booking_automation_outbox_client_fk_idx
  on public.booking_automation_outbox (client_id);
