begin;

create table if not exists public.review_submission_tokens (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists review_submission_tokens_shop_expiry_idx
  on public.review_submission_tokens(shop_id, expires_at);

alter table public.review_submission_tokens enable row level security;
revoke all on public.review_submission_tokens from public, anon, authenticated;
grant all on public.review_submission_tokens to service_role;

-- Disable the legacy tokenless RPC. All new public reviews must be tied to a
-- completed appointment and a single-use, expiring capability.
revoke all on function public.submit_public_review(uuid, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.submit_public_review(uuid, text, integer, text)
  to service_role;

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
  v_name text := left(trim(coalesce(p_client_name, '')), 120);
  v_comment text := nullif(left(trim(coalesce(p_comment, '')), 2000), '');
begin
  if p_shop_id is null or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}
    raise exception using errcode = '22023', message = 'REVIEW_TOKEN_REQUIRED';
  end if;

  if v_name = '' then
    raise exception using errcode = '22023', message = 'REVIEW_NAME_REQUIRED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'REVIEW_RATING_INVALID';
  end if;

  select t.id
    into v_token_id
  from public.review_submission_tokens t
  join public.appointments a
    on a.id = t.appointment_id
   and a.status = 'completed'::public.appointment_status
  join public.shops s
    on s.id = t.shop_id
   and s.barbershop_id = a.barbershop_id
   and s.id = p_shop_id
   and s.is_active = true
  join public.barbershops b
    on b.id = s.barbershop_id
   and coalesce(b.is_public_in_directory, true) = true
  where t.shop_id = p_shop_id
    and t.token_hash = p_token_hash
    and t.consumed_at is null
    and t.expires_at > now()
  for update of t;

  if not found then
    raise exception using errcode = '42501', message = 'REVIEW_TOKEN_INVALID_OR_EXPIRED';
  end if;

  insert into public.reviews (barbershop_id, client_name, rating, comment)
  values (p_shop_id, v_name, p_rating, v_comment)
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
  is 'Submits one review only with an expiring single-use token issued for a completed appointment.';

commit;
 then
    raise exception using errcode = '22023', message = 'REVIEW_TOKEN_REQUIRED';
  end if;

  if v_name = '' then
    raise exception using errcode = '22023', message = 'REVIEW_NAME_REQUIRED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'REVIEW_RATING_INVALID';
  end if;

  select t.id
    into v_token_id
  from public.review_submission_tokens t
  join public.appointments a
    on a.id = t.appointment_id
   and a.status = 'completed'::public.appointment_status
  join public.shops s
    on s.id = t.shop_id
   and s.barbershop_id = a.barbershop_id
   and s.id = p_shop_id
   and s.is_active = true
  join public.barbershops b
    on b.id = s.barbershop_id
   and coalesce(b.is_public_in_directory, true) = true
  where t.shop_id = p_shop_id
    and t.token_hash = p_token_hash
    and t.consumed_at is null
    and t.expires_at > now()
  for update of t;

  if not found then
    raise exception using errcode = '42501', message = 'REVIEW_TOKEN_INVALID_OR_EXPIRED';
  end if;

  insert into public.reviews (barbershop_id, client_name, rating, comment)
  values (p_shop_id, v_name, p_rating, v_comment)
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
  is 'Submits one review only with an expiring single-use token issued for a completed appointment.';

commit;
 then
    raise exception using errcode = '22023', message = 'REVIEW_TOKEN_REQUIRED';
  end if;

  if v_name = '' then
    raise exception using errcode = '22023', message = 'REVIEW_NAME_REQUIRED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'REVIEW_RATING_INVALID';
  end if;

  select t.id
    into v_token_id
  from public.review_submission_tokens t
  join public.appointments a
    on a.id = t.appointment_id
   and a.status = 'completed'::public.appointment_status
  join public.shops s
    on s.id = t.shop_id
   and s.barbershop_id = a.barbershop_id
   and s.id = p_shop_id
   and s.is_active = true
  join public.barbershops b
    on b.id = s.barbershop_id
   and coalesce(b.is_public_in_directory, true) = true
  where t.shop_id = p_shop_id
    and t.token_hash = p_token_hash
    and t.consumed_at is null
    and t.expires_at > now()
  for update of t;

  if not found then
    raise exception using errcode = '42501', message = 'REVIEW_TOKEN_INVALID_OR_EXPIRED';
  end if;

  insert into public.reviews (barbershop_id, client_name, rating, comment)
  values (p_shop_id, v_name, p_rating, v_comment)
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
  is 'Submits one review only with an expiring single-use token issued for a completed appointment.';

commit;
 then
    raise exception using errcode = '22023', message = 'REVIEW_TOKEN_REQUIRED';
  end if;

  if v_name = '' then
    raise exception using errcode = '22023', message = 'REVIEW_NAME_REQUIRED';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception using errcode = '22023', message = 'REVIEW_RATING_INVALID';
  end if;

  select t.id
    into v_token_id
  from public.review_submission_tokens t
  join public.appointments a
    on a.id = t.appointment_id
   and a.status = 'completed'::public.appointment_status
  join public.shops s
    on s.id = t.shop_id
   and s.barbershop_id = a.barbershop_id
   and s.id = p_shop_id
   and s.is_active = true
  join public.barbershops b
    on b.id = s.barbershop_id
   and coalesce(b.is_public_in_directory, true) = true
  where t.shop_id = p_shop_id
    and t.token_hash = p_token_hash
    and t.consumed_at is null
    and t.expires_at > now()
  for update of t;

  if not found then
    raise exception using errcode = '42501', message = 'REVIEW_TOKEN_INVALID_OR_EXPIRED';
  end if;

  insert into public.reviews (barbershop_id, client_name, rating, comment)
  values (p_shop_id, v_name, p_rating, v_comment)
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
  is 'Submits one review only with an expiring single-use token issued for a completed appointment.';

commit;
