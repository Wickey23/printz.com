alter table public.products
add column if not exists personalization_enabled boolean not null default false,
add column if not exists personalization_prompt text,
add column if not exists color_options text[] default '{}',
add column if not exists size_options text[] default '{}',
add column if not exists finish_options text[] default '{}',
add column if not exists processing_time text,
add column if not exists care_instructions text;
