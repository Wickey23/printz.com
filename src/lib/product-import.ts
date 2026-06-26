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
    const existing = await findExistingProduct(raw, supabase);
    if (existing.error) {
      errors.push(`Row ${item.rowNumber}: ${existing.error.message}`);
      continue;
    }

    const existingProduct = existing.data as Product | null | undefined;
    const name = importValue(raw, ["name", "product_name", "title"], existingProduct?.name || "");
    const pricing = suggestImportPrice(raw);
    const parsed = productSchema.safeParse({
      name,
      slug: importValue(raw, ["slug"], existingProduct?.slug || slugify(name)),
      short_description: importValue(raw, ["short_description", "description"], existingProduct?.short_description || name),
      full_description: importValue(raw, ["full_description", "description"], existingProduct?.full_description || ""),
      category: importValue(raw, ["category"], existingProduct?.category || "Functional Prints"),
      price: raw.price || pricing.price || valueToString(existingProduct?.price),
      etsy_url: importValue(raw, ["etsy_url"], existingProduct?.etsy_url || ""),
      main_image_url: importValue(raw, ["main_image_url"], existingProduct?.main_image_url || ""),
      video_url: importValue(raw, ["video_url"], existingProduct?.video_url || ""),
      drive_media_folder_url: importValue(raw, ["drive_media_folder_url", "drive_folder_url"], existingProduct?.drive_media_folder_url || ""),
      materials: importValue(raw, ["materials"], existingProduct?.materials || ""),
      dimensions: importValue(raw, ["dimensions"], existingProduct?.dimensions || ""),
      customization_notes: importValue(raw, ["customization_notes"], existingProduct?.customization_notes || ""),
      personalization_enabled: hasImportValue(raw, "personalization_enabled") ? parseImportBoolean(raw.personalization_enabled) : Boolean(existingProduct?.personalization_enabled),
      personalization_prompt: importValue(raw, ["personalization_prompt"], existingProduct?.personalization_prompt || ""),
      color_options: importValue(raw, ["color_options", "colors"], listToString(existingProduct?.color_options)),
      size_options: importValue(raw, ["size_options", "sizes"], listToString(existingProduct?.size_options)),
      finish_options: importValue(raw, ["finish_options", "finishes"], listToString(existingProduct?.finish_options)),
      processing_time: importValue(raw, ["processing_time"], existingProduct?.processing_time || ""),
      care_instructions: importValue(raw, ["care_instructions"], existingProduct?.care_instructions || ""),
      source_url: importValue(raw, ["source_url", "makerworld_url"], existingProduct?.source_url || ""),
      license_notes: importValue(raw, ["license_notes", "license"], existingProduct?.license_notes || ""),
      tags: importValue(raw, ["tags"], listToString(existingProduct?.tags)),
      featured: hasImportValue(raw, "featured") ? parseImportBoolean(raw.featured) : Boolean(existingProduct?.featured),
      active: hasImportValue(raw, "active") ? parseImportBoolean(raw.active) : Boolean(existingProduct?.active),
    });

    if (!parsed.success) {
      errors.push(`Row ${item.rowNumber}: ${Object.values(parsed.error.flatten().fieldErrors).flat().join(" ")}`);
      continue;
    }

    const payload = { ...parsed.data, active: parsed.data.active === true, updated_at: new Date().toISOString() };
    const existingId = existingProduct?.id;
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

    const savedProduct = result.data as Product;
    const shouldImportDriveMedia =
      hasImportValue(raw, "drive_media_folder_url") || hasImportValue(raw, "drive_folder_url") || (!existingId && Boolean(savedProduct.drive_media_folder_url));
    const imported = shouldImportDriveMedia ? await importDriveMediaForProduct(savedProduct, supabase).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Row ${item.rowNumber}: saved product, but Drive media import failed: ${message}`);
      mediaStatus = `Drive media error: ${message}`;
      return false;
    }) : false;
    if (imported) {
      mediaImported++;
      mediaStatus = "Imported Drive folder media.";
    }

    const importedAt = new Date().toISOString();
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

async function findExistingProduct(raw: Record<string, string>, supabase: SupabaseAdmin) {
  const productId = raw.product_id?.trim();
  if (productId) {
    return fromTable(supabase, "products").select("*").eq("id", productId).maybeSingle();
  }

  const slug = raw.slug?.trim();
  if (slug) {
    return fromTable(supabase, "products").select("*").eq("slug", slug).maybeSingle();
  }

  return { data: null, error: null } satisfies QueryResult;
}

function importValue(raw: Record<string, string>, keys: string[], fallback: string) {
  for (const key of keys) {
    if (hasImportValue(raw, key)) return raw[key].trim();
  }
  return fallback;
}

function hasImportValue(raw: Record<string, string>, key: string) {
  return Object.prototype.hasOwnProperty.call(raw, key) && raw[key].trim() !== "";
}

function listToString(value: string[] | null | undefined) {
  return Array.isArray(value) ? value.join(", ") : "";
}

function valueToString(value: string | number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
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
