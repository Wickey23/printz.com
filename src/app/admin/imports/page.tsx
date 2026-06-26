import Link from "next/link";
import { ProductImportPanel } from "@/components/product-import-panel";
import { importTemplates } from "@/lib/mass-import-templates";
import { requireAdmin } from "@/lib/auth";

export default async function AdminImportsPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Mass imports</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Download a CSV template, edit it in Google Sheets or Excel, export/download as CSV, then upload it here. Existing products can be updated by
            <span className="font-semibold text-zinc-200"> product_id</span> or <span className="font-semibold text-zinc-200">slug</span>. Blank cells preserve existing values on update templates.
          </p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
          Back to admin
        </Link>
      </div>

      <div className="grid gap-6">
        <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-zinc-50">Download editable templates</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Use the full product template for new listings. Use the smaller update templates when you only need to change media, pricing, or rights data.
              </p>
            </div>
            <a className="inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950" href="/api/import-templates?type=full_product">
              Download full template
            </a>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {importTemplates.map((template) => (
              <div className="rounded-lg border border-white/10 bg-zinc-950 p-4" key={template.key}>
                <h3 className="font-bold text-zinc-50">{template.label}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{template.description}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a className="inline-flex h-9 items-center rounded-md border border-white/10 px-3 text-sm font-bold text-amber-200" href={`/api/import-templates?type=${template.key}`}>
                    Download CSV
                  </a>
                  <span className="inline-flex h-9 items-center rounded-md bg-zinc-900 px-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                    {template.headers.length} columns
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <ProductImportPanel />

        <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
          <h2 className="text-xl font-black text-zinc-50">Rules this importer follows</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-300">
            <li>New products are created inactive unless the CSV active column is TRUE.</li>
            <li>Existing rows update by product_id first, then slug.</li>
            <li>Blank cells on update templates keep the current site value.</li>
            <li>Drive folder URLs can import images and videos into the product carousel.</li>
            <li>If price is blank and grams/hours are present, the site generates a draft price and writes it back to the CSV source sheet when writeback fields exist.</li>
            <li>Rights and license notes are stored with the product, but the system does not guarantee legal clearance. Keep risky products inactive until reviewed.</li>
          </ul>
        </section>
      </div>
    </section>
  );
}
