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

drop trigger if exists print_stock_options_set_updated_at on public.print_stock_options;
create trigger print_stock_options_set_updated_at
before update on public.print_stock_options
for each row execute function public.set_updated_at();

alter table public.print_stock_options enable row level security;

drop policy if exists "Public can read active print stock options" on public.print_stock_options;
create policy "Public can read active print stock options"
on public.print_stock_options for select
using (active = true);

drop policy if exists "Service role can manage print stock options" on public.print_stock_options;
create policy "Service role can manage print stock options"
on public.print_stock_options for all
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

create index if not exists print_stock_options_type_active_idx on public.print_stock_options(option_type, active, sort_order);
