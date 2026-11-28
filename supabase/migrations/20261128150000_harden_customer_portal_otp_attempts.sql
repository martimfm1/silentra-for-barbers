begin;

-- Keep existing rows valid while tightening the per-code attempt ceiling.
update public.booking_portal_verifications
set attempts = least(attempts, 3)
where attempts > 3;

alter table public.booking_portal_verifications
  drop constraint if exists booking_portal_verifications_attempts_check;

alter table public.booking_portal_verifications
  add constraint booking_portal_verifications_attempts_check
  check (attempts >= 0 and attempts <= 3);

create or replace function public.verify_booking_portal_code(
  p_email text,
  p_code_hash text
)
returns table(ok boolean, error_code text, verification_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.booking_portal_verifications%rowtype;
begin
  select *
    into v_row
  from public.booking_portal_verifications
  where lower(email) = lower(trim(p_email))
    and consumed_at is null
    and expires_at > now()
  order by requested_at desc
  limit 1
  for update;

  if not found then
    return query select false, 'INVALID_OR_EXPIRED'::text, null::uuid;
    return;
  end if;

  if v_row.attempts >= 3 then
    update public.booking_portal_verifications
    set consumed_at = coalesce(consumed_at, now())
    where id = v_row.id;
    return query select false, 'TOO_MANY_ATTEMPTS'::text, v_row.id;
    return;
  end if;

  if v_row.code_hash <> p_code_hash then
    update public.booking_portal_verifications
    set
      attempts = least(attempts + 1, 3),
      consumed_at = case
        when attempts + 1 >= 3 then now()
        else consumed_at
      end
    where id = v_row.id;

    return query select false, 'INVALID_OR_EXPIRED'::text, v_row.id;
    return;
  end if;

  -- Mark the code as consumed in the same transaction that validates it.
  -- The row lock makes concurrent requests unable to redeem it twice.
  update public.booking_portal_verifications
  set consumed_at = now()
  where id = v_row.id;

  return query select true, null::text, v_row.id;
end;
$$;

revoke all on function public.verify_booking_portal_code(text, text)
  from public, anon, authenticated;
grant execute on function public.verify_booking_portal_code(text, text)
  to service_role;

commit;
