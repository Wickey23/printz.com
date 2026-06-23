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

alter table public.etsy_trend_reports enable row level security;

drop policy if exists "Service role can manage Etsy trend reports" on public.etsy_trend_reports;
create policy "Service role can manage Etsy trend reports"
on public.etsy_trend_reports for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create index if not exists etsy_trend_reports_created_at_idx on public.etsy_trend_reports(created_at desc);
create index if not exists etsy_trend_reports_report_date_idx on public.etsy_trend_reports(report_date desc);
