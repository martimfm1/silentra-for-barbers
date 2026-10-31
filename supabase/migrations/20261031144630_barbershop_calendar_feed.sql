begin;

alter table public.barbershops
  add column if not exists calendar_feed_enabled boolean not null default false,
  add column if not exists calendar_feed_version integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'barbershops_calendar_feed_version_positive'
      and conrelid = 'public.barbershops'::regclass
  ) then
    alter table public.barbershops
      add constraint barbershops_calendar_feed_version_positive
      check (calendar_feed_version >= 1);
  end if;
end;
$$;

comment on column public.barbershops.calendar_feed_enabled is
  'Whether the private read-only iCalendar subscription feed is active.';
comment on column public.barbershops.calendar_feed_version is
  'Version used to revoke previously issued private iCalendar feed URLs.';

commit;
