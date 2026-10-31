begin;

-- A later RLS canonicalization migration recreated this permissive policy after
-- the original reviews migration correctly removed it. Anonymous review
-- submissions must go through submit_public_review(), which owns validation.
drop policy if exists "reviews_public_insert" on public.reviews;
drop policy if exists "Criar avaliações publicamente" on public.reviews;
revoke insert, update, delete on public.reviews from anon, authenticated;

comment on table public.reviews is
  'Public reads are allowed; public submissions must use the validated submit_public_review RPC.';

commit;
