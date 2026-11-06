begin;

-- Reviews remain available through a direct, appointment-bound link even when
-- a barbershop is hidden from the marketplace directory.
create or replace function public.submit_public_review_with_token(
  p_shop_id uuid,
  p_token_hash text,
  p_client_name text,
  p_rating integer,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_review public.reviews;
  v_token_id uuid;
  v_client_name text;
  v_comment text := nullif(left(trim(coalesce(p_comment, '')), 2000), '');
begin
  if p_shop_id is null
     or p_token_hash is null
     or length(p_token_hash) <> 64
     or translate(p_token_hash, '0123456789abcdef', '') <> '' then
    raise exception using errcode = '22023', message = 'REVIEW_TOKEN_REQUIRED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'REVIEW_RATING_INVALID';
  end if;

  -- The display name is sourced from the completed appointment rather than
  -- accepted from the anonymous browser request.
  select
    t.id,
    coalesce(
      nullif(left(trim(coalesce(a.manual_name, '')), 120), ''),
      nullif(left(trim(coalesce(u.name_complete, '')), 120), ''),
      'Cliente'
    )
  into v_token_id, v_client_name
  from public.review_submission_tokens t
  join public.appointments a
    on a.id = t.appointment_id
   and a.status = 'completed'::public.appointment_status
  join public.shops s
    on s.id = t.shop_id
   and s.barbershop_id = a.barbershop_id
   and s.id = p_shop_id
   and s.is_active = true
   and coalesce(s.public_profile_enabled, true) = true
  left join public.users u
    on u.id = a.client_id
   and u.barbershop_id = a.barbershop_id
  where t.shop_id = p_shop_id
    and t.token_hash = p_token_hash
    and t.consumed_at is null
    and t.expires_at > now()
  for update of t;

  if not found then
    raise exception using errcode = '42501', message = 'REVIEW_TOKEN_INVALID_OR_EXPIRED';
  end if;

  insert into public.reviews (barbershop_id, client_name, rating, comment)
  values (p_shop_id, v_client_name, p_rating, v_comment)
  returning * into v_review;

  update public.review_submission_tokens
    set consumed_at = now()
  where id = v_token_id
    and consumed_at is null;

  if not found then
    raise exception using errcode = '42501', message = 'REVIEW_TOKEN_ALREADY_USED';
  end if;

  return v_review;
end;
$$;

revoke all on function public.submit_public_review_with_token(uuid, text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_review_with_token(uuid, text, text, integer, text)
  to service_role;

comment on function public.submit_public_review_with_token(uuid, text, text, integer, text)
  is 'Submits one rating from an unexpired single-use token issued for a completed appointment. Customer display names are derived server-side.';

commit;
