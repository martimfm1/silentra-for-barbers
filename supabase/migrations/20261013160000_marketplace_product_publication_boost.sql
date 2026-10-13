begin;

alter table public.inventory_products
  add column if not exists marketplace_published_at timestamptz,
  add column if not exists marketplace_featured_until timestamptz;

-- The old schema did not retain a publication timestamp. Use created_at as a
-- conservative lower bound rather than updated_at, which may have changed after
-- publication and could incorrectly grant an old listing a new boost window.
update public.inventory_products
set marketplace_published_at = coalesce(created_at, updated_at, now())
where marketplace_visible = true
  and marketplace_published_at is null;

-- Legacy featured items are migrated to the same maximum three-day window.
update public.inventory_products
set marketplace_featured_until = marketplace_published_at + interval '3 days'
where marketplace_featured = true
  and marketplace_visible = true
  and marketplace_featured_until is null
  and marketplace_published_at is not null;

create index if not exists inventory_products_marketplace_featured_until_idx
  on public.inventory_products (marketplace_featured_until desc, updated_at desc)
  where active = true and marketplace_visible = true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'inventory_products_marketplace_featured_window_check'
      and conrelid = 'public.inventory_products'::regclass
  ) then
    alter table public.inventory_products
      add constraint inventory_products_marketplace_featured_window_check
      check (
        marketplace_featured_until is null
        or (
          marketplace_published_at is not null
          and marketplace_featured_until > marketplace_published_at
          and marketplace_featured_until <= marketplace_published_at + interval '3 days'
        )
      );
  end if;
end;
$$;

comment on column public.inventory_products.marketplace_published_at is
  'Timestamp of the first publication in the public marketplace; preserved on edits and unpublishing.';
comment on column public.inventory_products.marketplace_featured_until is
  'Enterprise-only promotional visibility deadline, capped at three days after first publication.';

commit;
