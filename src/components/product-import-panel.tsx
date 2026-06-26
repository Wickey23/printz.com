"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { importProductsFromCsv } from "@/app/actions";
import { ActionForm } from "@/components/action-form";

const defaultSpreadsheetId = "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";

type ImportPreview = {
  rows: Record<string, string>[];
  totalRows: number;
  activeRows: number;
  mediaFolderRows: number;
  missingNameRows: number;
  missingLicenseRows: number;
};

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && quoted && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some(Boolean)) {
        rows.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function buildImportPreview(csvText: string): ImportPreview | null {
  const rows = parseCsv(csvText);
  const [headers, ...dataRows] = rows;

  if (!headers?.length || !dataRows.length) {
    return null;
  }

  const normalizedHeaders = headers.map(normalizeHeader);
  const records = dataRows
    .map((dataRow) =>
      Object.fromEntries(normalizedHeaders.map((header, index) => [header, dataRow[index] ?? ""])),
    )
    .filter((record) => Object.values(record).some(Boolean));

  const getValue = (record: Record<string, string>, candidates: string[]) => {
    for (const candidate of candidates) {
      const normalized = normalizeHeader(candidate);
      if (record[normalized]) {
        return record[normalized];
      }
    }

    return "";
  };

  return {
    rows: records.slice(0, 5),
    totalRows: records.length,
    activeRows: records.filter((record) => getValue(record, ["active", "active on site"]).toLowerCase() === "true").length,
    mediaFolderRows: records.filter((record) => getValue(record, ["drive media folder url", "media folder url", "drive folder"])).length,
    missingNameRows: records.filter((record) => !getValue(record, ["name", "product name", "title"])).length,
    missingLicenseRows: records.filter((record) => !getValue(record, ["license notes", "license type", "license url", "rights status"])).length,
  };
}

export function ProductImportPanel() {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewWarnings = useMemo(() => {
    if (!preview) {
      return [];
    }

    return [
      preview.missingNameRows ? `${preview.missingNameRows} row(s) missing a name/title.` : null,
      preview.missingLicenseRows ? `${preview.missingLicenseRows} row(s) missing license or rights fields.` : null,
      preview.mediaFolderRows ? null : "No Drive media folder URLs found; imported products may have no gallery.",
    ].filter(Boolean);
  }, [preview]);

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
              <input
                accept=".csv,text/csv"
                className="rounded-md border border-white/10 bg-zinc-950 p-3 text-sm text-zinc-100"
                name="product_import_file"
                onChange={async (event) => {
                  const file = event.currentTarget.files?.[0];
                  setPreview(null);
                  setPreviewError(null);

                  if (!file) {
                    return;
                  }

                  try {
                    const csvText = await file.text();
                    const nextPreview = buildImportPreview(csvText);

                    if (!nextPreview) {
                      setPreviewError("No product rows found in this CSV.");
                      return;
                    }

                    setPreview(nextPreview);
                  } catch {
                    setPreviewError("Could not read this CSV for preview.");
                  }
                }}
                required
                type="file"
              />
            </label>
            {preview ? (
              <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-950/70 p-4">
                <div className="grid gap-2 text-sm text-zinc-200 sm:grid-cols-3">
                  <p>
                    <span className="font-black text-zinc-50">{preview.totalRows}</span> row(s)
                  </p>
                  <p>
                    <span className="font-black text-zinc-50">{preview.activeRows}</span> active
                  </p>
                  <p>
                    <span className="font-black text-zinc-50">{preview.mediaFolderRows}</span> with Drive media
                  </p>
                </div>
                {previewWarnings.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-amber-200">
                    {previewWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-left text-xs text-zinc-300">
                    <thead className="text-zinc-100">
                      <tr>
                        <th className="border-b border-white/10 py-2 pr-3">Name</th>
                        <th className="border-b border-white/10 py-2 pr-3">Category</th>
                        <th className="border-b border-white/10 py-2 pr-3">Price</th>
                        <th className="border-b border-white/10 py-2 pr-3">Active</th>
                        <th className="border-b border-white/10 py-2 pr-3">Drive media</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, index) => (
                        <tr key={`${row.name ?? "row"}-${index}`}>
                          <td className="border-b border-white/5 py-2 pr-3">{row.name || row.product_name || row.title || "Missing"}</td>
                          <td className="border-b border-white/5 py-2 pr-3">{row.category || "—"}</td>
                          <td className="border-b border-white/5 py-2 pr-3">{row.price || row.ai_suggested_price || "AI/site"}</td>
                          <td className="border-b border-white/5 py-2 pr-3">{row.active || row.active_on_site || "FALSE"}</td>
                          <td className="border-b border-white/5 py-2 pr-3">{row.drive_media_folder_url || row.media_folder_url || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {previewError ? <p className="text-sm font-semibold text-amber-200">{previewError}</p> : null}
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
