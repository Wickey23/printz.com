-- PRINTZ product command center hardening.
alter table public.products
  add column if not exists workflow_status text not null default 'Research',
  add column if not exists sheet_row_id text,
  add column if not exists source_url_normalized text,
  add column if not exists sync_version bigint not null default 1,
  add column if not exists sheet_synced_at timestamptz,
  add column if not exists last_sync_source text,
  add column if not exists content_hash text,
  add column if not exists archived_at timestamptz,
  add column if not exists source_platform text,
  add column if not exists creator_name text,
  add column if not exists license_type text,
  add column if not exists license_url text,
  add column if not exists commercial_sale_allowed boolean,
  add column if not exists modification_allowed boolean,
  add column if not exists attribution_required boolean,
  add column if not exists share_alike_required boolean,
  add column if not exists trademark_review_status text not null default 'Not Required',
  add column if not exists rights_reviewed_at timestamptz,
  add column if not exists rights_status text not null default 'Needs Review',
  add column if not exists attribution_text text,
  add column if not exists rights_snapshot text,
  add column if not exists media_status text not null default 'Missing',
  add column if not exists drive_media_folder_url text,
  add column if not exists estimated_grams numeric(10,2),
  add column if not exists estimated_print_hours numeric(10,2),
  add column if not exists material_cost_per_gram numeric(10,4),
  add column if not exists machine_hourly_cost numeric(10,2),
  add column if not exists labor_cost numeric(10,2),
  add column if not exists packaging_cost numeric(10,2),
  add column if not exists failure_allowance_percent numeric(6,2),
  add column if not exists marketplace_fee_percent numeric(6,2),
  add column if not exists target_margin_percent numeric(6,2),
  add column if not exists estimated_cost numeric(10,2),
  add column if not exists suggested_price numeric(10,2),
  add column if not exists pricing_status text not null default 'Needs Inputs';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='products_workflow_status_check') then
    alter table public.products add constraint products_workflow_status_check check (workflow_status in ('Research','Needs Review','Ready','Queued','Processing','Live','Blocked','Conflict','Archived'));
  end if;
  if not exists (select 1 from pg_constraint where conname='products_rights_status_check') then
    alter table public.products add constraint products_rights_status_check check (rights_status in ('Needs Review','Approved','Blocked','Not Applicable'));
  end if;
  if not exists (select 1 from pg_constraint where conname='products_media_status_check') then
    alter table public.products add constraint products_media_status_check check (media_status in ('Missing','Ready','Processing','Error'));
  end if;
end $$;

create unique index if not exists products_sheet_row_id_idx on public.products(sheet_row_id) where sheet_row_id is not null;
create index if not exists products_source_url_normalized_idx on public.products(source_url_normalized) where source_url_normalized is not null;
create index if not exists products_workflow_status_idx on public.products(workflow_status,active);

create table if not exists public.product_sync_runs (
 id uuid primary key default gen_random_uuid(), run_id uuid not null, product_id uuid references public.products(id) on delete set null,
 sheet_name text, sheet_row integer, operation text not null, status text not null, attempt integer not null default 1,
 before_values jsonb, after_values jsonb, error text, started_at timestamptz not null default now(), finished_at timestamptz
);
create table if not exists public.product_sync_dead_letters (
 id uuid primary key default gen_random_uuid(), product_id uuid references public.products(id) on delete set null,
 sheet_name text, sheet_row integer, payload jsonb not null, error text not null, attempts integer not null default 1,
 resolved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists product_sync_runs_run_id_idx on public.product_sync_runs(run_id,started_at);
create index if not exists product_sync_runs_product_id_idx on public.product_sync_runs(product_id,started_at desc);

drop trigger if exists product_sync_dead_letters_set_updated_at on public.product_sync_dead_letters;
create trigger product_sync_dead_letters_set_updated_at before update on public.product_sync_dead_letters for each row execute function public.set_updated_at();
alter table public.product_sync_runs enable row level security;
alter table public.product_sync_dead_letters enable row level security;
drop policy if exists "Service role can manage product sync runs" on public.product_sync_runs;
create policy "Service role can manage product sync runs" on public.product_sync_runs for all using (auth.role()='service_role') with check (auth.role()='service_role');
drop policy if exists "Service role can manage product sync dead letters" on public.product_sync_dead_letters;
create policy "Service role can manage product sync dead letters" on public.product_sync_dead_letters for all using (auth.role()='service_role') with check (auth.role()='service_role');

create or replace function public.bump_product_sync_version() returns trigger as $$ begin new.sync_version=old.sync_version+1; return new; end; $$ language plpgsql;
drop trigger if exists products_bump_sync_version on public.products;
create trigger products_bump_sync_version before update on public.products for each row execute function public.bump_product_sync_version();

create or replace function public.enforce_product_activation_rights()
returns trigger as $$
begin
  if new.rights_status = 'Blocked' then
    new.active = false;
    new.featured = false;
    new.workflow_status = 'Blocked';
  elsif new.active and (tg_op = 'INSERT' or not coalesce(old.active, false))
    and new.rights_status not in ('Approved', 'Not Applicable') then
    raise exception 'Product rights must be Approved or Not Applicable before activation';
  end if;
  if new.archived_at is not null then
    new.active = false;
    new.featured = false;
    new.workflow_status = 'Archived';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_enforce_activation_rights on public.products;
create trigger products_enforce_activation_rights before insert or update on public.products
for each row execute function public.enforce_product_activation_rights();