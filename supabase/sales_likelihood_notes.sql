alter table public.products
  add column if not exists sales_likelihood_score integer not null default 50,
  add column if not exists sales_likelihood_notes text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_sales_likelihood_score_check') then
    alter table public.products add constraint products_sales_likelihood_score_check
      check (sales_likelihood_score between 1 and 100);
  end if;
end $$;

create index if not exists products_sales_likelihood_score_idx
  on public.products(sales_likelihood_score desc, created_at desc);

-- Supabase/PostgREST can keep a stale schema cache after DDL.
-- This makes the new columns available to the app and service-role scripts sooner.
notify pgrst, 'reload schema';
