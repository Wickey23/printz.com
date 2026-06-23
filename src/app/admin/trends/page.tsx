import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getEtsyTrendReportsForAdmin } from "@/lib/data";
import type { EtsyTrendRecommendedListing, EtsyTrendReport } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrendReportsPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  const reports = await getEtsyTrendReportsForAdmin();

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Etsy trend reports</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            Running list of dated research reports for PRINTZ. Each report focuses on Etsy opportunities for digital products, 3D printed products,
            and hybrid listing ideas.
          </p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
          Back to admin
        </Link>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <ArchiveStat label="Saved reports" value={String(reports.length)} />
        <ArchiveStat label="Newest report" value={reports[0] ? formatDate(reports[0].report_date) : "None yet"} />
        <ArchiveStat label="Archive behavior" value="Reports stay saved and can be reopened anytime" />
      </div>

      <div className="grid gap-4">
        {reports.map((report, index) => (
          <ReportAccordion defaultOpen={index === 0} key={report.id} report={report} />
        ))}

        {!reports.length ? (
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-6">
            <h2 className="text-xl font-bold text-zinc-50">No reports yet</h2>
            <p className="mt-2 text-zinc-400">The daily Etsy research automation will add dated reports here after it runs.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ArchiveStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-zinc-100">{value}</p>
    </div>
  );
}

function ReportAccordion({ report, defaultOpen }: { report: EtsyTrendReport; defaultOpen: boolean }) {
  const listing = report.recommended_listing || {};

  return (
    <details className="group rounded-lg border border-white/10 bg-zinc-900/70" open={defaultOpen}>
      <summary className="grid cursor-pointer list-none gap-4 p-5 marker:hidden md:grid-cols-[1fr_auto]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">{formatDate(report.report_date)}</p>
            <time className="rounded-md bg-zinc-950 px-2 py-1 text-xs font-semibold text-zinc-400" dateTime={report.created_at}>
              {formatTimestamp(report.created_at)}
            </time>
          </div>
          <h2 className="mt-2 text-2xl font-black text-zinc-50">{report.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{report.summary}</p>
          <p className="mt-3 text-sm font-bold text-amber-200">
            Recommendation: {listing.title || "No recommended listing recorded"}
          </p>
        </div>
        <div className="flex items-start justify-between gap-3 md:justify-end">
          <span className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-200">
            {listing.product_type || "Report"}
          </span>
          <ChevronDown className="mt-2 text-zinc-400 transition group-open:rotate-180" size={20} />
        </div>
      </summary>

      <div className="border-t border-white/10 p-5">
        <p className="leading-7 text-zinc-300">{report.summary}</p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <ListBlock title="Top observed trends" items={report.top_trends} />
          <ListBlock title="Listing ideas" items={report.listing_ideas} />
        </div>

        <RecommendedListing listing={listing} />

        {report.source_notes ? (
          <div className="mt-4 rounded-md border border-white/10 bg-zinc-950 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Source notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{report.source_notes}</p>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-300">
        {items.map((item) => (
          <li className="rounded bg-white/[0.03] px-3 py-2" key={item}>
            {item}
          </li>
        ))}
        {!items.length ? <li className="text-zinc-500">No items recorded.</li> : null}
      </ul>
    </div>
  );
}

function RecommendedListing({ listing }: { listing: EtsyTrendRecommendedListing }) {
  const rows = [
    ["Type", listing.product_type],
    ["Price", listing.price],
    ["Category", listing.category],
    ["Tags", listing.tags?.join(", ")],
    ["Files or variants", listing.files_or_variants],
    ["Photo plan", listing.photo_plan],
    ["Next steps", listing.next_steps],
  ].filter(([, value]) => value);

  return (
    <div className="mt-4 rounded-md border border-amber-300/20 bg-amber-300/[0.06] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">Best listing to make next</p>
      <h3 className="mt-2 text-xl font-black text-zinc-50">{listing.title || "No recommended listing recorded"}</h3>
      {listing.description ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{listing.description}</p> : null}
      {rows.length ? (
        <dl className="mt-4 grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div className="rounded-md border border-white/10 bg-zinc-950/80 p-3" key={label}>
              <dt className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
