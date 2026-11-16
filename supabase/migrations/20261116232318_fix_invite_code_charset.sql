begin;

-- Generate invite codes from the exact alphabet accepted by the onboarding API.
-- The previous generator used hexadecimal characters (0-9, A-F), which could
-- emit 0 or 1 even though the public BARB code format explicitly excludes them.
create or replace function public.create_barbershop_invite_code(p_role text default 'barber')
returns table (code text, expires_at timestamptz, role text)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user uuid := auth.uid();
  v_barbershop_id uuid;
  v_code text;
  v_hash text;
  v_expires timestamptz := now() + interval '10 minutes';
  v_suffix text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_random_byte integer;
  v_index integer;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if p_role is null or p_role not in ('admin', 'manager', 'barber', 'receptionist') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;

  select u.barbershop_id
    into v_barbershop_id
  from public.users u
  where u.id = v_user
    and u.role in ('owner', 'admin');

  if v_barbershop_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  loop
    v_suffix := '';

    -- Rejection sampling avoids modulo bias while keeping all eight characters
    -- inside the format accepted by the invite entry flow.
    for v_index in 1..8 loop
      loop
        v_random_byte := get_byte(gen_random_bytes(1), 0);
        exit when v_random_byte < (256 / length(v_alphabet)) * length(v_alphabet);
      end loop;

      v_suffix := v_suffix || substr(
        v_alphabet,
        (v_random_byte % length(v_alphabet)) + 1,
        1
      );
    end loop;

    v_code := 'BARB-' || substr(v_suffix, 1, 4) || '-' || substr(v_suffix, 5, 4);
    v_hash := encode(digest(v_code, 'sha256'), 'hex');

    exit when not exists (
      select 1
      from public.barbershop_invite_codes i
      where i.code_hash = v_hash
    );
  end loop;

  insert into public.barbershop_invite_codes (
    barbershop_id,
    code_hash,
    role,
    expires_at,
    created_by
  )
  values (
    v_barbershop_id,
    v_hash,
    p_role,
    v_expires,
    v_user
  );

  return query select v_code, v_expires, p_role;
end;
$function$;

revoke all on function public.create_barbershop_invite_code(text)
  from public, anon;
grant execute on function public.create_barbershop_invite_code(text)
  to authenticated;

notify pgrst, 'reload schema';

commit;
