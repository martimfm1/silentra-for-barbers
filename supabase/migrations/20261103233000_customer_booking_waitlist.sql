begin;

create table if not exists public.booking_waitlist (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  professional_id uuid references public.professionals(id) on delete set null,
  customer_name text not null check (char_length(btrim(customer_name)) between 2 and 120),
  customer_email text not null check (char_length(customer_email) between 5 and 254),
  customer_phone text not null check (char_length(customer_phone) between 7 and 30),
  preferred_date date not null,
  preferred_time_start time,
  preferred_time_end time,
  status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'booked', 'cancelled', 'expired')),
  consented_at timestamptz not null,
  last_contacted_at timestamptz,
  offer_expires_at timestamptz,
  linked_appointment_id uuid references public.appointments(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_waitlist_time_range_check check (
    (preferred_time_start is null and preferred_time_end is null)
    or (
      preferred_time_start is not null
      and preferred_time_end is not null
      and preferred_time_start < preferred_time_end
    )
  )
);

create index if not exists booking_waitlist_shop_status_date_idx
  on public.booking_waitlist (barbershop_id, status, preferred_date, created_at);

create index if not exists booking_waitlist_shop_service_date_idx
  on public.booking_waitlist (shop_id, service_id, preferred_date, status);

create unique index if not exists booking_waitlist_active_duplicate_uidx
  on public.booking_waitlist (
    shop_id,
    lower(customer_email),
    preferred_date,
    service_id,
    coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('waiting', 'offered');

alter table public.booking_waitlist enable row level security;
revoke all on table public.booking_waitlist from public, anon, authenticated;
grant all on table public.booking_waitlist to service_role;

comment on table public.booking_waitlist is
  'Customer requests for a specific date/service when no suitable booking slot is available. Access only through tenant-scoped server APIs.';

commit;
