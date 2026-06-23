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

drop trigger if exists custom_print_requests_set_updated_at on public.custom_print_requests;
create trigger custom_print_requests_set_updated_at
before update on public.custom_print_requests
for each row execute function public.set_updated_at();

alter table public.custom_print_requests enable row level security;

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

insert into storage.buckets (id, name, public)
values ('print-uploads', 'print-uploads', false)
on conflict (id) do update set public = excluded.public;

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

create index if not exists custom_print_requests_user_id_idx on public.custom_print_requests(user_id, created_at desc);
create index if not exists custom_print_requests_status_idx on public.custom_print_requests(payment_status, production_status);
