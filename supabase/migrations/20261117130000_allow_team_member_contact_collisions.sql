begin;

-- Customer records and team-member accounts share public.users, but they are
-- different identities in the product. A barber/admin must be able to join a
-- shop even when a customer record already uses the same phone/email.
-- Keep contact uniqueness for customer records while allowing staff accounts
-- to share those contact values with customers.

alter table public.users
  drop constraint if exists users_phone_unique,
  drop constraint if exists users_email_unique;

create unique index if not exists users_client_phone_unique
  on public.users (barbershop_id, num_phone)
  where role = 'client' and num_phone is not null;

create unique index if not exists users_client_email_unique
  on public.users (barbershop_id, email)
  where role = 'client' and email is not null;

notify pgrst, 'reload schema';

commit;
