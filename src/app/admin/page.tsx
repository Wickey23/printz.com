import Link from "next/link";
import { archiveProduct, deleteSuggestion, signOutAdmin, updateSuggestionStatus } from "@/app/actions";
import { ProductSyncDryRunButton } from "@/components/product-sync-dry-run-button";
import { DeactivateAllProductsPanel } from "@/components/deactivate-all-products-panel";
import { requireAdmin } from "@/lib/auth";
import { getAllProductsForAdmin, getProductMediaForProducts, getProductSyncHealth, getSuggestionsForAdmin } from "@/lib/data";
import { etsyReadinessLabel, getEtsyReadiness } from "@/lib/etsy-readiness";
import { getLaunchAudit, type LaunchAuditSeverity, type LaunchAuditSummary } from "@/lib/launch-audit";
import { salesLikelihood } from "@/lib/sales-likelihood";
import type { Product, ProductMedia } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const auth = await requireAdmin();
  if (!auth.approved) return <AccessDenied email={auth.user.email || ""} />;

  const params = await searchParams;
  const [products, suggestions, syncHealth] = await Promise.all([getAllProductsForAdmin(), getSuggestionsForAdmin(), getProductSyncHealth()]);
  const mediaByProductId = await getProductMediaForProducts(products.map((product) => product.id));
  const sortedProducts = sortAdminProducts(products, params.sort || "newest", mediaByProductId);
  const launchAudit = getLaunchAudit({ mediaByProductId, products, syncHealth });

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/ai">
            AI listing
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/etsy">
            Etsy control
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/trends">
            Trend reports
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/pricing">
            Pricing
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/print-requests">
            Print requests
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/print-options">
            Stock options
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/imports">
            Imports
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-bold text-zinc-950" href="/admin/products/new">
            Add product
          </Link>
          <form action={signOutAdmin}>
            <button className="h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-8">
        <LaunchAuditPanel audit={launchAudit} />

        <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Product command center sync</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Use dry run to preview. Use live sync to pull checked Sheet rows into the site, import Drive media, and backfill the read-only Site Products tab from the current site database.
              </p>
            </div>
            <ProductSyncDryRunButton />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SyncPill label="Supabase" ok={syncHealth.configured.supabase} />
            <SyncPill label="Google service account" ok={syncHealth.configured.google} />
            <SyncPill label="Sync secret" ok={syncHealth.configured.secret} />
            <SyncPill label="Migration tables" ok={syncHealth.migrationReady} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">Latest run</h3>
              {syncHealth.lastRun ? (
                <div className="mt-3 text-sm leading-6 text-zinc-300">
                  <p>Started: {new Date(syncHealth.lastRun.started_at).toLocaleString()}</p>
                  <p>Status counts: {Object.entries(syncHealth.latestRunCounts).map(([status, count]) => `${status}: ${count}`).join(", ") || "none"}</p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No sync runs recorded yet.</p>
              )}
            </div>
            <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
              <h3 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">Recent issues</h3>
              {syncHealth.recentErrors.length || syncHealth.deadLetters.length ? (
                <ul className="mt-3 grid gap-2 text-sm text-zinc-300">
                  {[...syncHealth.recentErrors.slice(0, 4), ...syncHealth.deadLetters.slice(0, 2)].map((item, index) => (
                    <li className="rounded bg-red-500/10 p-2 text-red-100" key={`${"run_id" in item ? item.id : item.id}-${index}`}>
                      {"status" in item ? `Row ${item.sheet_row || "?"}: ${item.status}${item.error ? ` - ${item.error}` : ""}` : `Dead letter row ${item.sheet_row || "?"}: ${item.error}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No recent sync issues.</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm font-bold">
            <a className="text-amber-200" href="https://docs.google.com/spreadsheets/d/14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs/edit#gid=1826938160" rel="noreferrer" target="_blank">
              Open XLOOKUP import source
            </a>
            <Link className="text-amber-200" href="/admin/products/new">Create manual product</Link>
          </div>
        </section>

        <DeactivateAllProductsPanel />

        <section className="rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="border-b border-white/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Products</h2>
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <SortLink active={(params.sort || "newest") === "newest"} href="/admin" label="Newest" />
                <SortLink active={params.sort === "sell-score"} href="/admin?sort=sell-score" label="Best likely sellers" />
                <SortLink active={params.sort === "needs-review"} href="/admin?sort=needs-review" label="Needs review" />
              </div>
            </div>
          </div>
          <div className="divide-y divide-white/10">
            {sortedProducts.map((product) => (
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={product.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-zinc-50">{product.name}</h3>
                    <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{product.category}</span>
                    {(() => {
                      const sales = productSales(product, mediaByProductId[product.id] || []);
                      return (
                        <span className="rounded bg-emerald-400/15 px-2 py-1 text-xs text-emerald-200">
                          Sell score {sales.score}
                        </span>
                      );
                    })()}
                    <EtsyReadinessBadge product={product} />
                    {!product.active ? <span className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-200">Inactive</span> : null}
                    {product.featured ? <span className="rounded bg-amber-300/15 px-2 py-1 text-xs text-amber-200">Featured</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{product.short_description}</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/90">{productSales(product, mediaByProductId[product.id] || []).notes}</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-200">{formatPrice(product.price)}</p>
                  {product.source_url ? (
                    <a className="mt-2 inline-flex text-sm font-bold text-amber-200" href={product.source_url} rel="noreferrer" target="_blank">
                      Source model listing
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Link className="text-sm font-bold text-amber-200" href={`/admin/products/${product.id}`}>
                    Edit
                  </Link>
                  <form action={archiveProduct}>
                    <input name="id" type="hidden" value={product.id} />
                    <button className="text-sm font-bold text-red-300" type="submit">
                      Archive
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {!products.length ? <p className="p-5 text-zinc-400">No products yet.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Suggestions</h2>
          </div>
          <div className="divide-y divide-white/10">
            {suggestions.map((suggestion) => (
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={suggestion.id}>
                <div>
                  <h3 className="font-bold text-zinc-50">{suggestion.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {suggestion.name} - {suggestion.email} - {new Date(suggestion.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{suggestion.description}</p>
                </div>
                <div className="grid gap-3">
                  <form action={updateSuggestionStatus} className="flex gap-2">
                    <input name="id" type="hidden" value={suggestion.id} />
                    <select className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm" defaultValue={suggestion.status} name="status">
                      {["New", "Reviewing", "In Progress", "Made", "Rejected"].map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <button className="h-10 rounded-md bg-zinc-50 px-3 text-sm font-bold text-zinc-950" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteSuggestion}>
                    <input name="id" type="hidden" value={suggestion.id} />
                    <button className="text-sm font-bold text-red-300" type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {!suggestions.length ? <p className="p-5 text-zinc-400">No suggestions yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function sortAdminProducts(products: Awaited<ReturnType<typeof getAllProductsForAdmin>>, sort: string, mediaByProductId: Record<string, ProductMedia[]>) {
  const copy = [...products];
  if (sort === "sell-score") {
    return copy.sort(
      (a, b) =>
        Number(b.tags?.includes("first-publish-batch") || false) - Number(a.tags?.includes("first-publish-batch") || false) ||
        Number(b.active) - Number(a.active) ||
        productSales(b, mediaByProductId[b.id] || []).score - productSales(a, mediaByProductId[a.id] || []).score ||
        String(b.created_at).localeCompare(String(a.created_at)),
    );
  }
  if (sort === "needs-review") {
    return copy.sort((a, b) => Number(a.workflow_status !== "Needs Review") - Number(b.workflow_status !== "Needs Review") || String(b.created_at).localeCompare(String(a.created_at)));
  }
  return copy;
}

function productSales(product: Product, media: ProductMedia[]) {
  if (product.sales_likelihood_score && product.sales_likelihood_notes) {
    return { score: product.sales_likelihood_score, notes: product.sales_likelihood_notes };
  }
  const imageCount = new Set([product.main_image_url, ...media.filter((item) => item.media_type === "image").map((item) => item.url)].filter(Boolean)).size;
  return salesLikelihood({ ...product, imageCount });
}

function SortLink({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link className={active ? "rounded bg-amber-300 px-3 py-2 text-zinc-950" : "rounded border border-white/10 px-3 py-2 text-zinc-300"} href={href}>
      {label}
    </Link>
  );
}

function LaunchAuditPanel({ audit }: { audit: LaunchAuditSummary }) {
  return (
    <section className="rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Launch audit</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-50">Business readiness snapshot</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">
            Use this as the operating checklist before driving traffic from Etsy, social posts, or ads.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <AuditStat label="Blockers" value={audit.blockers} tone="blocker" />
          <AuditStat label="Warnings" value={audit.warnings} tone="warning" />
          <AuditStat label="Ready" value={audit.ready} tone="ready" />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Active" value={audit.activeProducts} />
        <Metric label="Etsy links" value={audit.purchasableProducts} />
        <Metric label="Requests" value={audit.requestOnlyProducts} />
        <Metric label="Draft ready" value={audit.draftReadyProducts} />
        <Metric label="Publish ready" value={audit.publishReadyProducts} />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {audit.items.map((item) => (
          <a
            className={`rounded-md border p-4 transition hover:border-amber-300/50 ${auditItemClass(item.severity)}`}
            href={item.href || "/admin"}
            key={item.key}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-black text-zinc-50">{item.label}</h3>
              <span className={`rounded px-2 py-1 text-xs font-black uppercase ${auditBadgeClass(item.severity)}`}>
                {item.severity}
              </span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{item.detail}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950 p-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-zinc-50">{value}</p>
    </div>
  );
}

function AuditStat({ label, tone, value }: { label: string; tone: LaunchAuditSeverity; value: number }) {
  return (
    <div className={`min-w-20 rounded-md border px-3 py-2 ${auditItemClass(tone)}`}>
      <p className="text-xl font-black text-zinc-50">{value}</p>
      <p className="text-xs font-bold text-zinc-400">{label}</p>
    </div>
  );
}

function auditItemClass(severity: LaunchAuditSeverity) {
  if (severity === "blocker") return "border-red-400/20 bg-red-500/10";
  if (severity === "warning") return "border-amber-300/20 bg-amber-300/10";
  return "border-emerald-400/20 bg-emerald-400/10";
}

function auditBadgeClass(severity: LaunchAuditSeverity) {
  if (severity === "blocker") return "bg-red-400/15 text-red-100";
  if (severity === "warning") return "bg-amber-300/15 text-amber-100";
  return "bg-emerald-400/15 text-emerald-100";
}

function AccessDenied({ email }: { email: string }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-4xl font-black text-zinc-50">Access denied</h1>
      <p className="mt-4 text-zinc-400">{email} is signed in, but is not in the approved admin list.</p>
    </section>
  );
}

function SyncPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className={ok ? "rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3" : "rounded-md border border-red-400/20 bg-red-500/10 p-3"}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">{label}</p>
      <p className={ok ? "mt-1 text-sm font-bold text-emerald-200" : "mt-1 text-sm font-bold text-red-200"}>{ok ? "Ready" : "Needs setup"}</p>
    </div>
  );
}

function EtsyReadinessBadge({ product }: { product: Parameters<typeof getEtsyReadiness>[0] }) {
  const readiness = getEtsyReadiness(product);
  const className = readiness.readyToPublish
    ? "rounded bg-emerald-400/15 px-2 py-1 text-xs text-emerald-200"
    : readiness.readyToDraft
      ? "rounded bg-amber-300/15 px-2 py-1 text-xs text-amber-200"
      : "rounded bg-red-500/15 px-2 py-1 text-xs text-red-200";

  return <span className={className}>Etsy: {etsyReadinessLabel(readiness)}</span>;
}
