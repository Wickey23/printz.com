alter table public.products
add column if not exists etsy_listing_id bigint unique,
add column if not exists etsy_state text,
add column if not exists synced_from_etsy_at timestamptz;

create unique index if not exists products_etsy_listing_id_idx
on public.products(etsy_listing_id)
where etsy_listing_id is not null;
