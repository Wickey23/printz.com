"use client";

import { Upload } from "lucide-react";
import { importProductsFromCsv } from "@/app/actions";
import { ActionForm } from "@/components/action-form";

const defaultSpreadsheetId = "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";

export function ProductImportPanel() {
  return (
    <section className="grid gap-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
      <div>
        <h2 className="text-xl font-black text-zinc-50">Bulk product import</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Use Google Sheets as a simple staging database: copy the template, fill rows, export/download as CSV, then upload here. Imported products default to inactive unless the CSV active column is TRUE. If you provide the source Sheet tab name, product IDs, media status, and generated draft pricing write back to the Sheet.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-100" href="/api/products/import-template">
          Download CSV template
        </a>
      </div>
      <ActionForm action={importProductsFromCsv} className="grid gap-3">
        {(state, pending) => (
          <>
            <label className="grid gap-2 text-sm font-semibold text-zinc-200">
              Upload completed CSV
              <input accept=".csv,text/csv" className="rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-100" name="product_import_file" required type="file" />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-zinc-200">
                Source spreadsheet ID for writeback
                <input className="rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-100" defaultValue={defaultSpreadsheetId} name="source_spreadsheet_id" placeholder="Google Sheet ID" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-zinc-200">
                Source tab name for writeback
                <input className="rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-100" name="source_sheet_name" placeholder="2026-06-26 Product Import" />
              </label>
            </div>
            <p className="text-xs leading-5 text-zinc-400">
              Writeback is optional. It only runs when the Sheet tab has output columns such as import_status, product_id, site_url, media_status, ai_suggested_price, ai_price_notes, and imported_at.
            </p>
            <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending} type="submit">
              <Upload size={16} />
              {pending ? "Importing..." : "Import products"}
            </button>
            {state.message ? <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>{state.message}</p> : null}
          </>
        )}
      </ActionForm>
    </section>
  );
}
