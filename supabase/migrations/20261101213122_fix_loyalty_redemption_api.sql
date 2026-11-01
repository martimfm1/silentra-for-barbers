begin;

-- PostgREST RPCs must resolve to a single signature. The 5-argument version
-- predates encrypted voucher recovery and conflicts with the current 7-argument API.
drop function if exists public.redeem_loyalty_reward(
  uuid,
  uuid,
  text,
  text,
  timestamptz
);

create or replace function public.redeem_loyalty_reward(
  p_member_id uuid,
  p_reward_id uuid,
  p_token_hash text,
  p_code_hash text,
  p_token_encrypted text,
  p_code_encrypted text,
  p_expires_at timestamptz
)
returns table (
  redemption_id uuid,
  points_balance integer,
  points_cost integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.loyalty_members%rowtype;
  v_reward public.loyalty_rewards%rowtype;
  v_redemption_id uuid;
  v_new_balance integer;
begin
  if p_member_id is null
    or p_reward_id is null
    or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_code_hash !~ '^[0-9a-f]{64}$'
    or p_token_encrypted is null
    or length(p_token_encrypted) > 2048
    or p_code_encrypted is null
    or length(p_code_encrypted) > 2048
    or p_expires_at is null
    or p_expires_at <= now()
    or p_expires_at > now() + interval '1 hour'
  then
    raise exception 'LOYALTY_REDEMPTION_INVALID';
  end if;

  perform public.expire_loyalty_redemptions();

  -- Serialize reservations for this member. The pending check below therefore
  -- remains correct even when the customer double-clicks or sends concurrent requests.
  select lm.*
    into v_member
    from public.loyalty_members as lm
   where lm.id = p_member_id
     and lm.status = 'active'
   for update;

  if not found then
    raise exception 'LOYALTY_MEMBER_NOT_FOUND';
  end if;

  select lr.*
    into v_reward
    from public.loyalty_rewards as lr
   where lr.id = p_reward_id
     and lr.barbershop_id = v_member.barbershop_id
     and lr.active = true
   for update;

  if not found then
    raise exception 'LOYALTY_REWARD_NOT_FOUND';
  end if;

  if exists (
    select 1
      from public.loyalty_redemptions as existing
     where existing.member_id = v_member.id
       and existing.status = 'pending'
       and existing.expires_at > now()
  ) then
    raise exception 'LOYALTY_ACTIVE_REDEMPTION_EXISTS';
  end if;

  if v_member.points_balance < v_reward.points_cost then
    raise exception 'LOYALTY_INSUFFICIENT_POINTS';
  end if;

  update public.loyalty_members as lm
     set points_balance = lm.points_balance - v_reward.points_cost,
         updated_at = now()
   where lm.id = v_member.id
  returning lm.points_balance into v_new_balance;

  insert into public.loyalty_redemptions (
    barbershop_id,
    member_id,
    reward_id,
    points_spent,
    status,
    token_hash,
    code_hash,
    token_encrypted,
    code_encrypted,
    expires_at,
    created_at,
    updated_at
  )
  values (
    v_member.barbershop_id,
    v_member.id,
    v_reward.id,
    v_reward.points_cost,
    'pending',
    p_token_hash,
    p_code_hash,
    p_token_encrypted,
    p_code_encrypted,
    p_expires_at,
    now(),
    now()
  )
  returning id into v_redemption_id;

  insert into public.loyalty_member_transactions (
    barbershop_id,
    member_id,
    points,
    type,
    reference_id,
    description
  )
  values (
    v_member.barbershop_id,
    v_member.id,
    -v_reward.points_cost,
    'redemption',
    v_redemption_id,
    v_reward.name
  );

  redemption_id := v_redemption_id;
  points_balance := v_new_balance;
  points_cost := v_reward.points_cost;
  return next;
end;
$$;

revoke all on function public.redeem_loyalty_reward(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.redeem_loyalty_reward(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  timestamptz
) to service_role;

notify pgrst, 'reload schema';

commit;
