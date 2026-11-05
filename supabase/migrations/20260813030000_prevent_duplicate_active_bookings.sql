-- Prevent conflicting active appointments while preserving existing history.
-- The existing database may contain duplicates created before this constraint existed.
-- During migration we keep one active appointment per booking key and mark the
-- redundant active rows as cancelled instead of deleting business data.

begin;

-- For appointments assigned to a professional, different professionals may
-- occupy the same time. For unassigned appointments, the slot remains unique
-- at barbershop level (represented by NULL professional_id).
--
-- Conflict resolution priority:
--   1. scheduled beats pending
--   2. lower UUID wins as a deterministic tie-breaker
-- Redundant rows are cancelled, not deleted.
with ranked as (
  select
    id,
    row_number() over (
      partition by barbershop_id, date_hour,
        case when professional_id is null then '00000000-0000-0000-0000-000000000000'::uuid else professional_id end
      order by
        case when status = 'scheduled' then 0 else 1 end,
        id
    ) as rn
  from public.appointments
  where status in ('pending', 'scheduled')
)
update public.appointments a
set status = 'cancelled'
from ranked r
where a.id = r.id
  and r.rn > 1;

-- One active appointment per barbershop/time/professional assignment.
-- A NULL professional_id is treated as one shared unassigned slot.
create unique index if not exists appointments_active_slot_unique_idx
  on public.appointments (
    barbershop_id,
    date_hour,
    coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('pending', 'scheduled');

comment on index public.appointments_active_slot_unique_idx is
  'Prevents duplicate active appointments for the same barbershop/time/professional assignment; unassigned slots remain unique.';

commit;
