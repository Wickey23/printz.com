create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text not null,
  full_description text,
  category text not null,
  price numeric(10, 2),
  etsy_url text,
  main_image_url text,
  video_url text,
  materials text,
  dimensions text,
  customization_notes text,
  personalization_enabled boolean not null default false,
  personalization_prompt text,
  color_options text[] default '{}',
  size_options text[] default '{}',
  finish_options text[] default '{}',
  processing_time text,
  care_instructions text,
  source_url text,
  license_notes text,
  etsy_listing_id bigint unique,
  etsy_state text,
  synced_from_etsy_at timestamptz,
  sales_likelihood_score integer not null default 50 check (sales_likelihood_score between 1 and 100),
  sales_likelihood_notes text,
  tags text[] default '{}',
  featured boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'video')),
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  title text not null,
  description text not null,
  category text not null,
  reference_link text,
  budget_range text,
  status text not null default 'New' check (status in ('New', 'Reviewing', 'In Progress', 'Made', 'Rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.etsy_trend_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null default current_date,
  title text not null,
  summary text not null,
  top_trends text[] not null default '{}',
  listing_ideas text[] not null default '{}',
  recommended_listing jsonb not null default '{}'::jsonb,
  source_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.custom_print_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_email text not null,
  title text not null,
  notes text,
  material text not null default 'PLA',
  color text not null default 'Black',
  finish text not null default 'Standard',
  infill_percent integer not null default 15,
  quantity integer not null default 1,
  estimated_grams numeric(10, 2),
  estimated_hours numeric(10, 2),
  shipping_name text not null,
  shipping_address text not null,
  model_source_url text,
  model_source_platform text,
  file_urls text[] not null default '{}',
  file_names text[] not null default '{}',
  image_urls text[] not null default '{}',
  estimate_cents integer not null default 0,
  quoted_cents integer,
  etsy_checkout_url text,
  payment_status text not null default 'quote_pending' check (payment_status in ('quote_pending', 'checkout_pending', 'paid', 'canceled', 'refunded')),
  production_status text not null default 'new' check (production_status in ('new', 'reviewing', 'ready_to_print', 'printing', 'shipped', 'completed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_stock_options (
  id uuid primary key default gen_random_uuid(),
  option_type text not null check (option_type in ('material', 'color', 'finish')),
  name text not null,
  value text not null,
  hex_color text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_type, value)
);

create table if not exists public.printable_models (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_platform text not null,
  source_url text not null unique,
  image_url text,
  category text,
  tags text[] not null default '{}',
  license_summary text,
  print_notes text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.private_app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists custom_print_requests_set_updated_at on public.custom_print_requests;
create trigger custom_print_requests_set_updated_at
before update on public.custom_print_requests
for each row execute function public.set_updated_at();

drop trigger if exists print_stock_options_set_updated_at on public.print_stock_options;
create trigger print_stock_options_set_updated_at
before update on public.print_stock_options
for each row execute function public.set_updated_at();

drop trigger if exists printable_models_set_updated_at on public.printable_models;
create trigger printable_models_set_updated_at
before update on public.printable_models
for each row execute function public.set_updated_at();

drop trigger if exists private_app_settings_set_updated_at on public.private_app_settings;
create trigger private_app_settings_set_updated_at
before update on public.private_app_settings
for each row execute function public.set_updated_at();

alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.suggestions enable row level security;
alter table public.contact_messages enable row level security;
alter table public.etsy_trend_reports enable row level security;
alter table public.custom_print_requests enable row level security;
alter table public.print_stock_options enable row level security;
alter table public.printable_models enable row level security;
alter table public.admin_users enable row level security;
alter table public.private_app_settings enable row level security;

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
on public.products for select
using (active = true);

drop policy if exists "private app settings are service-role only" on public.private_app_settings;
create policy "private app settings are service-role only"
on public.private_app_settings
for all
using (false)
with check (false);

drop policy if exists "Public can read active product media" on public.product_media;
create policy "Public can read active product media"
on public.product_media for select
using (
  exists (
    select 1 from public.products
    where products.id = product_media.product_id
    and products.active = true
  )
);

drop policy if exists "Public can submit suggestions" on public.suggestions;
create policy "Public can submit suggestions"
on public.suggestions for insert
with check (true);

drop policy if exists "Public can submit contact messages" on public.contact_messages;
create policy "Public can submit contact messages"
on public.contact_messages for insert
with check (true);

drop policy if exists "Service role can manage Etsy trend reports" on public.etsy_trend_reports;
create policy "Service role can manage Etsy trend reports"
on public.etsy_trend_reports for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Users can read their own print requests" on public.custom_print_requests;
create policy "Users can read their own print requests"
on public.custom_print_requests for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can create their own print requests" on public.custom_print_requests;
create policy "Users can create their own print requests"
on public.custom_print_requests for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Service role can manage print requests" on public.custom_print_requests;
create policy "Service role can manage print requests"
on public.custom_print_requests for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Public can read active print stock options" on public.print_stock_options;
create policy "Public can read active print stock options"
on public.print_stock_options for select
using (active = true);

drop policy if exists "Service role can manage print stock options" on public.print_stock_options;
create policy "Service role can manage print stock options"
on public.print_stock_options for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "Public can read active printable models" on public.printable_models;
create policy "Public can read active printable models"
on public.printable_models for select
using (active = true);

drop policy if exists "Service role can manage printable models" on public.printable_models;
create policy "Service role can manage printable models"
on public.printable_models for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.print_stock_options (option_type, name, value, hex_color, sort_order)
values
  ('material', 'PLA', 'PLA', null, 10),
  ('material', 'PETG', 'PETG', null, 20),
  ('material', 'TPU', 'TPU', null, 30),
  ('color', 'Black', 'Black', '#111111', 10),
  ('color', 'White', 'White', '#f4f4f5', 20),
  ('color', 'Gray', 'Gray', '#71717a', 30),
  ('color', 'Red', 'Red', '#ef4444', 40),
  ('color', 'Blue', 'Blue', '#3b82f6', 50),
  ('color', 'Green', 'Green', '#22c55e', 60),
  ('finish', 'Standard', 'Standard', null, 10),
  ('finish', 'Matte', 'Matte', null, 20),
  ('finish', 'Silk', 'Silk', null, 30)
on conflict (option_type, value) do nothing;

insert into public.printable_models (title, source_platform, source_url, category, tags, license_summary, print_notes, sort_order)
values
  ('Modern ribbed desk organizer', 'MakerWorld', 'https://makerworld.com/en/models/783651-modern-desk-organizer-low-waste-no-ams-needed', 'Desk organization', array['desk', 'organizer', 'office', 'teacher'], 'Source model must be checked before commercial printing.', 'Good starter request for office, teacher desk, and study setups.', 10),
  ('Parametric organizer box', 'MakerWorld', 'https://makerworld.com/en/models/1660223-parametric-desk-organizer-fully-customizable', 'Storage', array['parametric', 'box', 'storage', 'organizer'], 'Confirm source license and customer-selected dimensions before quote.', 'Useful for custom sizes and classroom supply storage.', 20),
  ('Hydro flask cup holder adapter', 'Printables', 'https://www.printables.com/model/120213-hydro-flask-cup-holder-adapter', 'Adapters', array['adapter', 'cup holder', 'replacement', 'utility'], 'Confirm source license before printing for resale or third-party customers.', 'Ask customer for bottle and cup-holder measurements.', 30),
  ('Customizable name desk organizer', 'MakerWorld', 'https://makerworld.com/en/models/2600234-customizable-name-desk-organizer', 'Personalized gifts', array['name', 'teacher gift', 'desk', 'personalized'], 'Personalization and source license must be reviewed before quote.', 'Strong request candidate for teacher gifts and office name plates.', 40)
on conflict (source_url) do nothing;

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('print-uploads', 'print-uploads', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public can view product media files" on storage.objects;
create policy "Public can view product media files"
on storage.objects for select
using (bucket_id = 'product-media');

drop policy if exists "Authenticated users can upload product media files" on storage.objects;
create policy "Authenticated users can upload product media files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-media');

drop policy if exists "Users can upload their own print files" on storage.objects;
create policy "Users can upload their own print files"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'print-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can read their own print files" on storage.objects;
create policy "Users can read their own print files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'print-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create index if not exists products_slug_idx on public.products(slug);
create index if not exists products_active_featured_idx on public.products(active, featured);
create index if not exists product_media_product_id_idx on public.product_media(product_id);
create index if not exists suggestions_created_at_idx on public.suggestions(created_at desc);
create index if not exists etsy_trend_reports_created_at_idx on public.etsy_trend_reports(created_at desc);
create index if not exists etsy_trend_reports_report_date_idx on public.etsy_trend_reports(report_date desc);
create index if not exists custom_print_requests_user_id_idx on public.custom_print_requests(user_id, created_at desc);
create index if not exists custom_print_requests_status_idx on public.custom_print_requests(payment_status, production_status);
create index if not exists print_stock_options_type_active_idx on public.print_stock_options(option_type, active, sort_order);
create index if not exists printable_models_active_sort_idx on public.printable_models(active, sort_order, created_at desc);
