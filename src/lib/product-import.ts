import { productSchema } from "@/lib/schemas";
import type { Product } from "@/lib/types";
import { slugify } from "@/lib/utils";
import { syncDriveMedia } from "../../scripts/lib/product-command-sync.mjs";
import { GoogleDriveClient } from "../../scripts/lib/google-drive-client.mjs";

export type ProductImportWriteback = {
  rowNumber: number;
  slug: string;
  productId: string;
  status: "created" | "updated";
  siteUrl: string;
  mediaStatus: string;
  aiSuggestedPrice: string;
  aiPriceNotes: string;
  importedAt: string;
};

export type ProductImportResult = {
  created: number;
  updated: number;
  mediaImported: number;
  errors: string[];
  writebacks: ProductImportWriteback[];
};

type QueryResult<T = Record<string, unknown>> = {
  data?: T | T[] | null;
  error?: { message: string } | null;
};

type SupabaseQuery = {
  select: (columns?: string) => SupabaseQuery;
  eq: (column: string, value: unknown) => SupabaseQuery;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
  update: (values: Record<string, unknown>) => SupabaseQuery;
  insert: (values: Record<string, unknown> | Record<string, unknown>[]) => SupabaseQuery;
  delete: () => SupabaseQuery;
};

type SupabaseAdmin = {
  from: (table: string) => unknown;
};

function fromTable(supabase: SupabaseAdmin, table: string) {
  return supabase.from(table) as SupabaseQuery;
}

export async function importProductsCsvText(input: string, supabase: SupabaseAdmin): Promise<ProductImportResult> {
  const rows = parseCsv(input);
  if (rows.length < 2) {
    return { created: 0, updated: 0, mediaImported: 0, errors: ["CSV needs a header row and at least one product row."], writebacks: [] };
  }

  const headers = rows[0].map(normalizeImportHeader);
  const products = rows
    .slice(1)
    .map((row, index) => ({ rowNumber: index + 2, values: rowToObject(headers, row) }))
    .filter((row) => Object.values(row.values).some(Boolean));

  let created = 0;
  let updated = 0;
  let mediaImported = 0;
  const errors: string[] = [];
  const writebacks: ProductImportWriteback[] = [];

  for (const item of products) {
    const raw = item.values;
    const name = raw.name || raw.product_name || "";
    const pricing = suggestImportPrice(raw);
    const parsed = productSchema.safeParse({
      name,
      slug: raw.slug || slugify(name),
      short_description: raw.short_description || raw.description || name,
      full_description: raw.full_description || raw.description || "",
      category: raw.category || "Functional Prints",
      price: raw.price || pricing.price || "",
      etsy_url: raw.etsy_url || "",
      main_image_url: raw.main_image_url || "",
      video_url: raw.video_url || "",
      drive_media_folder_url: raw.drive_media_folder_url || raw.drive_folder_url || "",
      materials: raw.materials || "",
      dimensions: raw.dimensions || "",
      customization_notes: raw.customization_notes || "",
      personalization_enabled: parseImportBoolean(raw.personalization_enabled),
      personalization_prompt: raw.personalization_prompt || "",
      color_options: raw.color_options || raw.colors || "",
      size_options: raw.size_options || raw.sizes || "",
      finish_options: raw.finish_options || raw.finishes || "",
      processing_time: raw.processing_time || "",
      care_instructions: raw.care_instructions || "",
      source_url: raw.source_url || raw.makerworld_url || "",
      license_notes: raw.license_notes || raw.license || "",
      tags: raw.tags || "",
      featured: parseImportBoolean(raw.featured),
      active: parseImportBoolean(raw.active),
    });

    if (!parsed.success) {
      errors.push(`Row ${item.rowNumber}: ${Object.values(parsed.error.flatten().fieldErrors).flat().join(" ")}`);
      continue;
    }

    const existing = await fromTable(supabase, "products").select("id").eq("slug", parsed.data.slug).maybeSingle();
    if (existing.error) {
      errors.push(`Row ${item.rowNumber}: ${existing.error.message}`);
      continue;
    }

    const payload = { ...parsed.data, active: parsed.data.active === true, updated_at: new Date().toISOString() };
    const existingId = (existing.data as { id?: string } | null | undefined)?.id;
    const result = existingId
      ? await fromTable(supabase, "products").update(payload).eq("id", existingId).select("*").single()
      : await fromTable(supabase, "products").insert(payload).select("*").single();

    if (result.error || !result.data) {
      errors.push(`Row ${item.rowNumber}: ${result.error?.message || "Could not save product."}`);
      continue;
    }

    if (existingId) updated++;
    else created++;

    let mediaStatus = "No media folder or gallery URLs supplied.";
    const directGalleryImported = await replaceImportedGalleryMedia((result.data as { id: string }).id, raw.gallery_media_urls || raw.gallery_urls || "", supabase);
    if (directGalleryImported) mediaStatus = "Imported direct gallery URLs.";

    const imported = await importDriveMediaForProduct(result.data as Product, supabase).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Row ${item.rowNumber}: saved product, but Drive media import failed: ${message}`);
      mediaStatus = `Drive media error: ${message}`;
      return false;
    });
    if (imported) {
      mediaImported++;
      mediaStatus = "Imported Drive folder media.";
    }

    const importedAt = new Date().toISOString();
    const savedProduct = result.data as Product;
    writebacks.push({
      rowNumber: item.rowNumber,
      slug: savedProduct.slug,
      productId: savedProduct.id,
      status: existingId ? "updated" : "created",
      siteUrl: productSiteUrl(savedProduct.slug),
      mediaStatus,
      aiSuggestedPrice: pricing.price,
      aiPriceNotes: pricing.notes,
      importedAt,
    });
  }

  return { created, updated, mediaImported, errors, writebacks };
}

async function replaceImportedGalleryMedia(productId: string, galleryUrls: string, supabase: SupabaseAdmin) {
  const urls = splitMediaUrls(galleryUrls);
  if (!urls.length) return false;
  await fromTable(supabase, "product_media").delete().eq("product_id", productId);
  await fromTable(supabase, "product_media").insert(urls.map((url, index) => ({ product_id: productId, media_type: mediaTypeFromUrl(url), url, sort_order: index })));
  return true;
}

async function importDriveMediaForProduct(product: Product, supabase: SupabaseAdmin) {
  if (!product.drive_media_folder_url) return false;
  await syncDriveMedia({
    drive: new GoogleDriveClient(process.env),
    supabase,
    product,
    folderUrl: product.drive_media_folder_url,
    row: product,
    sheets: { batch: async () => {} },
    report: { mediaUploads: 0, mediaSkipped: 0 },
  });
  return true;
}

function suggestImportPrice(raw: Record<string, string>) {
  if (raw.price) return { price: raw.price, notes: "Manual price supplied in import sheet." };

  const grams = optionalPositiveNumber(raw.estimated_grams || raw.grams);
  const hours = optionalPositiveNumber(raw.estimated_print_hours || raw.print_hours || raw.estimated_hours);
  if (!grams && !hours) return { price: "", notes: "Add estimated_grams and estimated_print_hours for an automatic draft price." };

  const materialCost = (grams || 0) * 0.04;
  const machineTime = (hours || 0) * 2.5;
  const handling = 3;
  const targetMargin = 0.45;
  const rawPrice = (materialCost + machineTime + handling) / targetMargin;
  const suggested = Math.max(9.99, Math.ceil(rawPrice) - 0.01).toFixed(2);
  return {
    price: suggested,
    notes: `Draft price from estimate: ${grams || 0}g material + ${hours || 0} print hours. Review before publishing.`,
  };
}

function optionalPositiveNumber(value: string) {
  const number = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function productSiteUrl(slug: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  return base ? `${base.replace(/\/$/, "")}/products/${slug}` : `/products/${slug}`;
}

function splitMediaUrls(value: string) {
  return Array.from(new Set(value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean)));
}

function mediaTypeFromUrl(url: string) {
  const clean = url.split("?")[0].toLowerCase();
  return clean.endsWith(".mp4") || clean.endsWith(".webm") || clean.endsWith(".mov") || clean.endsWith(".m4v") ? "video" : "image";
}

function parseCsv(input: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n") {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") cell += char;
  }

  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((value) => value.trim()));
}

function rowToObject(headers: string[], row: string[]) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || ""])) as Record<string, string>;
}

function normalizeImportHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseImportBoolean(value: string) {
  return ["true", "yes", "y", "1", "active", "featured"].includes(String(value || "").trim().toLowerCase());
}
