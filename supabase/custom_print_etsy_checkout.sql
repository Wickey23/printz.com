alter table public.custom_print_requests
add column if not exists quoted_cents integer,
add column if not exists etsy_checkout_url text;
