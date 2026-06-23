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

drop trigger if exists printable_models_set_updated_at on public.printable_models;
create trigger printable_models_set_updated_at
before update on public.printable_models
for each row execute function public.set_updated_at();

alter table public.printable_models enable row level security;

drop policy if exists "Public can read active printable models" on public.printable_models;
create policy "Public can read active printable models"
on public.printable_models for select
using (active = true);

drop policy if exists "Service role can manage printable models" on public.printable_models;
create policy "Service role can manage printable models"
on public.printable_models for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

insert into public.printable_models (title, source_platform, source_url, category, tags, license_summary, print_notes, sort_order)
values
  ('Modern ribbed desk organizer', 'MakerWorld', 'https://makerworld.com/en/models/783651-modern-desk-organizer-low-waste-no-ams-needed', 'Desk organization', array['desk', 'organizer', 'office', 'teacher'], 'Source model must be checked before commercial printing.', 'Good starter request for office, teacher desk, and study setups.', 10),
  ('Parametric organizer box', 'MakerWorld', 'https://makerworld.com/en/models/1660223-parametric-desk-organizer-fully-customizable', 'Storage', array['parametric', 'box', 'storage', 'organizer'], 'Confirm source license and customer-selected dimensions before quote.', 'Useful for custom sizes and classroom supply storage.', 20),
  ('Hydro flask cup holder adapter', 'Printables', 'https://www.printables.com/model/120213-hydro-flask-cup-holder-adapter', 'Adapters', array['adapter', 'cup holder', 'replacement', 'utility'], 'Confirm source license before printing for resale or third-party customers.', 'Ask customer for bottle and cup-holder measurements.', 30),
  ('Customizable name desk organizer', 'MakerWorld', 'https://makerworld.com/en/models/2600234-customizable-name-desk-organizer', 'Personalized gifts', array['name', 'teacher gift', 'desk', 'personalized'], 'Personalization and source license must be reviewed before quote.', 'Strong request candidate for teacher gifts and office name plates.', 40)
on conflict (source_url) do nothing;

create index if not exists printable_models_active_sort_idx on public.printable_models(active, sort_order, created_at desc);
