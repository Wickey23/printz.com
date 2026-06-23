alter table public.custom_print_requests
add column if not exists model_source_url text,
add column if not exists model_source_platform text;
