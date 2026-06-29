create table if not exists public.private_app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.private_app_settings enable row level security;

drop policy if exists "private app settings are service-role only" on public.private_app_settings;
create policy "private app settings are service-role only"
on public.private_app_settings
for all
using (false)
with check (false);

drop trigger if exists private_app_settings_set_updated_at on public.private_app_settings;
create trigger private_app_settings_set_updated_at
before update on public.private_app_settings
for each row execute function public.set_updated_at();
