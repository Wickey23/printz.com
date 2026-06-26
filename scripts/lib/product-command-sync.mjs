import {randomUUID} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
import {GoogleSheetsClient} from "./google-sheets-client.mjs";
import {GoogleDriveClient} from "./google-drive-client.mjs";
import {
  calculatePrice,
  findExistingProduct,
  hasSyncConflict,
  normalizeUrl,
  parseBoolean,
  parseList,
  parseNumber,
  productContentHash,
  slugify,
  validateProduct,
} from "./product-command-rules.mjs";

const SHEET_ID = "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";
const WORKING = "Product Intake";
const MIRROR = "Site Products";
const SPLIT_TABS = [];
const PRIMARY_WRITE_ORDER = [WORKING];

export async function runProductCommandSync({env = process.env, dryRun = false} = {}) {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service-role configuration is missing.");
  }

  const sheets = new GoogleSheetsClient({spreadsheetId: env.PRINTZ_PRODUCT_SHEET_ID || SHEET_ID, env});
  const drive = new GoogleDriveClient(env);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false},
  });
  const runId = randomUUID();
  const report = {
    runId,
    startedAt: new Date().toISOString(),
    dryRun,
    created: 0,
    updated: 0,
    blocked: 0,
    conflicts: 0,
    mediaUploads: 0,
    mediaSkipped: 0,
    errors: [],
  };

  const [{data: products, error}, grids] = await Promise.all([
    supabase.from("products").select("*").order("created_at"),
    readCommandCenterTabs(sheets),
  ]);
  if (error) throw error;

  const records = mergeCommandCenterRows(grids);
  const current = [...(products || [])];

  for (const record of records) {
    if (!parseBoolean(valueAny(record, ["Send to Final Stage / Site", "Sync to Site"]))) continue;

    const rowNumber = record.primary?.rowNumber || 0;
    const sheetName = record.primary?.sheetName || WORKING;
    const row = toProduct(record.row, record.idx, rowNumber, sheetName);
    const started = new Date().toISOString();
    let existing = null;
    let operation = "validate";

    try {
      existing = findExistingProduct(row, current).product;
      operation = existing ? "update" : "create";

      if (existing && hasSyncConflict(row, existing)) {
        report.conflicts++;
        await result(sheets, record, {
          status: `Conflict: Supabase version ${existing.sync_version} differs from Sheet version ${row.sync_version}.`,
          workflow: "Conflict",
          keep: true,
        }, dryRun);
        await audit(supabase, {runId, existing, rowNumber, sheetName, operation, status: "conflict", started, error: "Sync version mismatch"}, dryRun);
        continue;
      }

      const pricing = calculatePrice(row);
      const payload = clean({
        ...existing,
        ...row,
        id: undefined,
        slug: row.slug || slugify(row.name),
        main_image_url: row.main_image_url ?? existing?.main_image_url ?? null,
        video_url: row.video_url ?? existing?.video_url ?? null,
        drive_media_folder_url: row.drive_media_folder_url ?? existing?.drive_media_folder_url ?? null,
        source_url_normalized: normalizeUrl(row.source_url),
        estimated_cost: pricing.estimatedCost,
        suggested_price: pricing.suggestedPrice,
        pricing_status: pricing.status,
        price: row.price ?? pricing.suggestedPrice ?? existing?.price ?? null,
        sheet_row_id: row.sheet_row_id || `${sheetName}:${rowNumber}`,
        sheet_synced_at: new Date().toISOString(),
        last_sync_source: "google_sheet",
      });
      payload.content_hash = productContentHash(payload);

      const check = validateProduct(payload);
      if (!check.valid) {
        report.blocked++;
        await result(sheets, record, {
          status: `Blocked: ${check.errors.join(" ")}`,
          workflow: "Blocked",
          keep: true,
          errors: check.errors.join("\n"),
          estimatedCost: pricing.estimatedCost,
          suggestedPrice: pricing.suggestedPrice,
          priceStatus: pricing.status,
        }, dryRun);
        await audit(supabase, {runId, existing, rowNumber, sheetName, operation, status: "blocked", started, after: payload, error: check.errors.join(" ")}, dryRun);
        continue;
      }

      if (dryRun) {
        report[existing ? "updated" : "created"]++;
        continue;
      }

      const mutation = existing
        ? supabase.from("products").update(payload).eq("id", existing.id).select("*").single()
        : supabase.from("products").insert(payload).select("*").single();
      const {data: saved, error: saveError} = await mutation;
      if (saveError) throw saveError;

      await syncDriveMedia({drive, supabase, product: saved, folderUrl: row.drive_media_folder_url, row, record, sheets, report});

      const pos = current.findIndex((x) => x.id === saved.id);
      if (pos >= 0) current[pos] = saved;
      else current.push(saved);

      report[existing ? "updated" : "created"]++;
      await writeBack(sheets, record, saved, check.warnings);
      await audit(supabase, {runId, existing, rowNumber, sheetName, operation, status: "success", started, after: saved}, false);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      report.errors.push({sheet: sheetName, row: rowNumber, message});
      await result(sheets, record, {status: `Error: ${message}`, workflow: "Blocked", keep: true}, dryRun);
      await audit(supabase, {runId, existing, rowNumber, sheetName, operation, status: "error", started, error: message}, dryRun);
      await deadLetter(supabase, {existing, row, rowNumber, sheetName, error: message}, dryRun);
    }
  }

  if (!dryRun) {
    const {data, error} = await supabase.from("products").select("*").order("created_at");
    if (error) throw error;
    await mirror(sheets, data || []);
  }

  return {...report, finishedAt: new Date().toISOString()};
}

export async function syncDriveMedia({
  drive,
  supabase,
  product,
  folderUrl,
  row = {},
  idx = new Map(),
  rowNumber = 0,
  record = null,
  sheets = {batch: async () => {}},
  report = {mediaUploads: 0, mediaSkipped: 0},
}) {
  folderUrl = await resolveDriveMediaFolder({drive, folderUrl, product, row});
  if (!folderUrl) return;

  const writeTarget = record || {sources: [{sheetName: WORKING, rowNumber, idx}], idx, rowNumber};
  await named(sheets, writeTarget, {"Media Status": "Processing"});

  let files;
  try {
    files = await drive.listMedia(folderUrl);
  } catch (error) {
    await supabase.from("products").update({media_status: "Error", drive_media_folder_url: folderUrl}).eq("id", product.id);
    await named(sheets, writeTarget, {
      "Media Status": "Error",
      "Working Sync Status": `Media Error: ${error instanceof Error ? error.message : String(error)}`,
    });
    throw error;
  }

  if (!files.length) {
    await supabase.from("products").update({media_status: "Error", drive_media_folder_url: folderUrl}).eq("id", product.id);
    await named(sheets, writeTarget, {"Media Status": "Error"});
    throw new Error("Drive media folder contains no readable image or video files.");
  }

  const media = [];
  for (const file of files) {
    const safe = String(file.name || file.id).replace(/[^a-zA-Z0-9._-]+/g, "-");
    const path = `products/${product.id}/${file.id}-${safe}`;
    const publicUrl = supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
    let exists = false;

    try {
      const {data} = await supabase.storage.from("product-media").list(`products/${product.id}`, {search: `${file.id}-`});
      exists = Boolean((data || []).find((item) => item.name === `${file.id}-${safe}`));
    } catch {}

    if (!exists) {
      const downloaded = await drive.download(file.id);
      const {error} = await supabase.storage.from("product-media").upload(path, downloaded.bytes, {
        upsert: true,
        contentType: downloaded.contentType,
      });
      if (error) throw error;
      report.mediaUploads++;
    } else {
      report.mediaSkipped++;
    }

    media.push({url: publicUrl, media_type: file.mediaType});
  }

  const {error: deleteError} = await supabase.from("product_media").delete().eq("product_id", product.id);
  if (deleteError) throw deleteError;

  const {error: mediaError} = await supabase.from("product_media").insert(
    media.map((item, index) => ({product_id: product.id, media_type: item.media_type, url: item.url, sort_order: index})),
  );
  if (mediaError) throw mediaError;

  const firstImage = media.find((item) => item.media_type === "image")?.url || null;
  const firstVideo = media.find((item) => item.media_type === "video")?.url || null;
  const patch = {media_status: "Ready", drive_media_folder_url: folderUrl};
  if (!product.main_image_url && firstImage) patch.main_image_url = firstImage;
  if (!product.video_url && firstVideo) patch.video_url = firstVideo;

  const {error: updateError} = await supabase.from("products").update(patch).eq("id", product.id);
  if (updateError) throw updateError;

  Object.assign(product, patch);
  await named(sheets, writeTarget, {
    "Media Status": "Ready",
    "Main Image (Drive or Direct URL)": !row.main_image_url && patch.main_image_url ? patch.main_image_url : undefined,
    "Main Image (Drive File URL)": !row.main_image_url && patch.main_image_url ? patch.main_image_url : undefined,
    "Video URL": !row.video_url && patch.video_url ? patch.video_url : undefined,
    "Drive Media Folder URL": folderUrl,
  });
}

async function resolveDriveMediaFolder({drive, folderUrl, product, row}) {
  const env = drive?.env || process.env;
  const parentFolderUrl = env.PRINTZ_PRODUCT_MEDIA_PARENT_FOLDER_URL || env.PRINTZ_DRIVE_MEDIA_PARENT_FOLDER_URL || "";
  if (folderUrl) return folderUrl;
  if (!parentFolderUrl || typeof drive.findChildFolderByName !== "function") return folderUrl;

  const names = unique([
    product?.name,
    product?.slug,
    row?.name,
    row?.slug,
    slugify(product?.name || row?.name || ""),
  ].filter(Boolean));
  const match = await drive.findChildFolderByName(parentFolderUrl, names);
  return match?.url || folderUrl;
}
async function readCommandCenterTabs(sheets) {
  const names = [WORKING, ...SPLIT_TABS];
  const settled = await Promise.allSettled(names.map(async (name) => ({name, grid: await sheets.getValues(`${quoteSheet(name)}!A1:CS2000`)})));
  const grids = [];

  for (const item of settled) {
    if (item.status === "rejected") {
      if (String(item.reason?.message || item.reason).includes("Unable to parse range")) continue;
      throw item.reason;
    }
    if (!item.value.grid.length) continue;
    grids.push(normalizeGrid(item.value.name, item.value.grid));
  }

  if (!grids.find((grid) => grid.name === WORKING)) throw new Error(`${WORKING} has no header row.`);
  return grids;
}

function normalizeGrid(name, grid) {
  const headers = (grid[0] || []).map((header) => String(header || "").trim());
  const idx = new Map(headers.map((header, index) => [header, index]).filter(([header]) => header));
  return {name, headers, idx, rows: grid.slice(1)};
}

function mergeCommandCenterRows(grids) {
  const unionHeaders = unique(grids.flatMap((grid) => grid.headers.filter(Boolean)));
  const unionIdx = new Map(unionHeaders.map((header, index) => [header, index]));
  const byKey = new Map();

  for (const grid of grids) {
    for (let index = 0; index < grid.rows.length; index++) {
      const source = sourceRecord(grid, grid.rows[index], index + 2);
      if (!source.hasUsefulData) continue;

      const key = sourceIdentity(source);
      const existing = byKey.get(key) || {key, values: {}, sources: []};
      for (const [header, cell] of Object.entries(source.values)) {
        if (!isBlank(cell)) existing.values[header] = cell;
      }
      existing.sources.push(source);
      byKey.set(key, existing);
    }
  }

  return [...byKey.values()].map((record) => {
    const row = unionHeaders.map((header) => record.values[header]);
    return {
      ...record,
      idx: unionIdx,
      row,
      primary: choosePrimary(record.sources),
    };
  });
}

function sourceRecord(grid, row, rowNumber) {
  const values = {};
  for (const [header, index] of grid.idx.entries()) values[header] = row[index];
  return {
    sheetName: grid.name,
    rowNumber,
    idx: grid.idx,
    row,
    values,
    hasUsefulData: Object.entries(values).some(([header, cell]) => !isBlank(cell) && !["Ready Checklist", "Working Sync Status"].includes(header)),
  };
}

function sourceIdentity(source) {
  const id = text(source.values["Product ID"]);
  if (id) return `id:${id}`;

  const rowId = text(source.values["Canonical Row ID"]);
  if (rowId) return `row:${rowId}`;

  const sourceUrl = normalizeUrl(source.values["Source URL"] || source.values["Maker World Link"] || source.values["Source / MakerWorld URL"]);
  if (sourceUrl) return `source:${sourceUrl}`;

  const slug = text(source.values.Slug);
  if (slug) return `slug:${slug.toLowerCase()}`;

  const name = text(source.values.Name || source.values["Product Name"] || source.values["Bambu studio FOUND PRINT"]);
  if (name) return `name:${name.toLowerCase()}`;

  return `${source.sheetName}:${source.rowNumber}`;
}

function choosePrimary(sources) {
  const checked = sources.filter((source) => parseBoolean(source.values["Send to Final Stage / Site"]));
  const pool = checked.length ? checked : sources;
  for (const sheetName of PRIMARY_WRITE_ORDER) {
    const match = pool.find((source) => source.sheetName === sheetName);
    if (match) return match;
  }
  return pool[0] || null;
}

function value(record, name) {
  const pos = record.idx.get(name);
  return pos === undefined ? undefined : record.row[pos];
}

function valueAny(record, names) {
  for (const name of names) {
    const current = value(record, name);
    if (!isBlank(current)) return current;
  }
  return undefined;
}

function get(row, idx, name) {
  const i = idx.get(name);
  return i === undefined ? undefined : row[i];
}

function getAny(row, idx, names) {
  for (const name of names) {
    const current = get(row, idx, name);
    if (!isBlank(current)) return current;
  }
  return undefined;
}

function keywordFromSourceUrl(sourceUrl) {
  if (!sourceUrl) return null;
  try {
    const url = new URL(sourceUrl);
    const path = decodeURIComponent(url.pathname);
    const modelSegment = path.split("/").filter(Boolean).find((part) => /[a-z]/i.test(part) && !/^models?$|^en$/.test(part));
    const cleaned = String(modelSegment || "").replace(/^\d+[-_]?/, "").replace(/[-_]+/g, " ").trim();
    return cleaned || null;
  } catch {
    return null;
  }
}

function text(v) {
  const s = String(v ?? "").trim();
  return s || null;
}

function nullableBool(v) {
  return v === null || v === undefined || v === "" ? null : parseBoolean(v);
}

function toProduct(row, idx, n, sheetName = WORKING) {
  const sourceUrl = text(getAny(row, idx, ["Source URL", "Maker World Link", "Source / MakerWorld URL"]));
  const primaryKeyword = text(getAny(row, idx, ["Primary Keyword", "Product Keyword", "Keywords to search"])) || keywordFromSourceUrl(sourceUrl);
  const name = getAny(row, idx, ["Name", "Product Name", "Bambu studio FOUND PRINT"]) || primaryKeyword;
  return {
    id: text(get(row, idx, "Product ID")),
    name: text(name),
    slug: text(get(row, idx, "Slug")),
    short_description: text(getAny(row, idx, ["Short Description", "Description"])) || text(name),
    full_description: text(get(row, idx, "Full Description")) || text(getAny(row, idx, ["Short Description", "Description"])),
    category: text(get(row, idx, "Category")) || "Functional Prints",
    price: parseNumber(get(row, idx, "Price") ?? get(row, idx, "AI Draft Price")),
    etsy_url: text(get(row, idx, "Etsy URL")),
    main_image_url: text(get(row, idx, "Main Image (Drive or Direct URL)") ?? get(row, idx, "Main Image (Drive File URL)")),
    video_url: text(get(row, idx, "Video URL")),
    materials: text(getAny(row, idx, ["Materials", "Material Options (comma-separated)", "Material Choices (comma-separated)"])),
    dimensions: text(get(row, idx, "Dimensions")),
    customization_notes: text(get(row, idx, "Customization Notes")),
    personalization_enabled: parseBoolean(get(row, idx, "Personalization Enabled")),
    personalization_prompt: text(get(row, idx, "Personalization Prompt")),
    color_options: parseList(getAny(row, idx, ["Color Options", "Color Options (comma-separated)", "Color Choices (comma-separated)"])),
    size_options: parseList(get(row, idx, "Size Options (comma-separated)")),
    finish_options: parseList(get(row, idx, "Finish Options (comma-separated)")),
    processing_time: text(get(row, idx, "Processing Time")),
    care_instructions: text(get(row, idx, "Care Instructions")),
    source_url: sourceUrl,
    license_notes: text(get(row, idx, "License Notes")),
    tags: parseList(get(row, idx, "Tags") || primaryKeyword),
    featured: parseBoolean(get(row, idx, "Featured")),
    active: parseBoolean(get(row, idx, "Active on Site")),
    workflow_status: text(get(row, idx, "Workflow Status")) || "Queued",
    sync_version: parseNumber(get(row, idx, "Sync Version")),
    sheet_row_id: text(get(row, idx, "Canonical Row ID")) || `${sheetName}:${n}`,
    creator_name: text(get(row, idx, "Creator Name")),
    source_platform: text(get(row, idx, "Source Platform")) || (sourceUrl?.includes("makerworld.com") ? "MakerWorld" : null),
    license_type: text(get(row, idx, "License Type") ?? get(row, idx, "Column 13")),
    license_url: text(get(row, idx, "License URL")),
    commercial_sale_allowed: nullableBool(get(row, idx, "Commercial Sale Allowed") ?? get(row, idx, "Commercial Print Sale")),
    modification_allowed: nullableBool(get(row, idx, "Modification Allowed")),
    attribution_required: nullableBool(get(row, idx, "Attribution Required")),
    share_alike_required: nullableBool(get(row, idx, "Share-Alike Required")),
    trademark_review_status: text(get(row, idx, "Trademark Review")) || "Not Required",
    rights_status: text(get(row, idx, "Rights Status")) || "Needs Review",
    attribution_text: text(get(row, idx, "Attribution Text") ?? get(row, idx, "Etsy Attribution")),
    rights_snapshot: text(get(row, idx, "Rights Snapshot")),
    media_status: text(get(row, idx, "Media Status")) || "Missing",
    drive_media_folder_url: text(get(row, idx, "Drive Media Folder URL") ?? get(row, idx, "Gallery Folder or Image URLs")),
    estimated_grams: parseNumber(get(row, idx, "Estimated Grams")),
    estimated_print_hours: parseNumber(get(row, idx, "Estimated Print Hours")),
    material_cost_per_gram: parseNumber(get(row, idx, "Material Cost / Gram")),
    machine_hourly_cost: parseNumber(get(row, idx, "Machine Cost / Hour")),
    labor_cost: parseNumber(get(row, idx, "Labor Cost")),
    packaging_cost: parseNumber(get(row, idx, "Packaging Cost")),
    failure_allowance_percent: parseNumber(get(row, idx, "Failure Allowance %")),
    marketplace_fee_percent: parseNumber(get(row, idx, "Marketplace Fee %")),
    target_margin_percent: parseNumber(get(row, idx, "Target Margin %")),
  };
}

const allowed = [
  "name", "slug", "short_description", "full_description", "category", "price", "etsy_url", "main_image_url", "video_url", "materials", "dimensions", "customization_notes", "personalization_enabled", "personalization_prompt", "color_options", "size_options", "finish_options", "processing_time", "care_instructions", "source_url", "license_notes", "tags", "featured", "active", "workflow_status", "sheet_row_id", "source_url_normalized", "sheet_synced_at", "last_sync_source", "content_hash", "source_platform", "creator_name", "license_type", "license_url", "commercial_sale_allowed", "modification_allowed", "attribution_required", "share_alike_required", "trademark_review_status", "rights_status", "attribution_text", "rights_snapshot", "media_status", "drive_media_folder_url", "estimated_grams", "estimated_print_hours", "material_cost_per_gram", "machine_hourly_cost", "labor_cost", "packaging_cost", "failure_allowance_percent", "marketplace_fee_percent", "target_margin_percent", "estimated_cost", "suggested_price", "pricing_status",
];

function clean(p) {
  return Object.fromEntries(allowed.map((k) => [k, p[k] ?? null]));
}

async function named(sheets, target, values) {
  const data = [];
  const sources = target?.sources || [{sheetName: WORKING, rowNumber: target?.rowNumber || 0, idx: target instanceof Map ? target : target?.idx || new Map()}];

  for (const source of sources) {
    if (!source?.rowNumber || !source?.idx) continue;
    for (const [header, cellValue] of Object.entries(values)) {
      const pos = source.idx.get(header);
      if (pos !== undefined && cellValue !== undefined) {
        data.push({range: `${quoteSheet(source.sheetName)}!${col(pos + 1)}${source.rowNumber}`, values: [[cellValue ?? ""]]});
      }
    }
  }

  await sheets.batch(data);
}

async function writeBack(sheets, record, p, warnings) {
  await named(sheets, record, {
    "Send to Final Stage / Site": false,
    "Working Sync Status": `Success ${new Date().toISOString()} - Product ID ${p.id}${warnings.length ? ` - ${warnings.join(" ")}` : ""}`,
    "Product ID": p.id,
    "Name": p.name,
    "Slug": p.slug,
    "Price": p.price,
    "Active on Site": p.active,
    "Site URL": productSiteUrl(p.slug),
    "Workflow Status": p.active ? "Live" : "Ready",
    "Last Sync": p.sheet_synced_at,
    "Sync Version": p.sync_version,
    "Validation Errors": "",
    "Media Status": p.media_status,
    "Main Image (Drive or Direct URL)": p.main_image_url,
    "Video URL": p.video_url,
    "Drive Media Folder URL": p.drive_media_folder_url,
    "Estimated Cost": p.estimated_cost,
    "Suggested Price": p.suggested_price,
    "Pricing Status": p.pricing_status,
  });
}

async function result(sheets, record, r, dry) {
  if (!dry) {
    await named(sheets, record, {
      "Send to Final Stage / Site": r.keep === true,
      "Working Sync Status": r.status,
      "Workflow Status": r.workflow,
      "Validation Errors": r.errors,
      "Estimated Cost": r.estimatedCost,
      "Suggested Price": r.suggestedPrice,
      "Pricing Status": r.priceStatus,
    });
  }
}

async function deadLetter(supabase, x, dry) {
  if (dry) return;
  await supabase.from("product_sync_dead_letters").insert({
    product_id: x.existing?.id || null,
    sheet_name: x.sheetName || WORKING,
    sheet_row: x.rowNumber,
    payload: x.row,
    error: x.error,
    attempts: 1,
  });
}

async function audit(supabase, x, dry) {
  if (dry) return;
  await supabase.from("product_sync_runs").insert({
    run_id: x.runId,
    product_id: x.existing?.id || x.after?.id || null,
    sheet_name: x.sheetName || WORKING,
    sheet_row: x.rowNumber,
    operation: x.operation,
    status: x.status,
    before_values: x.existing || null,
    after_values: x.after || null,
    error: x.error || null,
    started_at: x.started,
    finished_at: new Date().toISOString(),
  });
}

async function mirror(sheets, products) {
  const h = ["Product ID", "Name", "Primary Keyword", "Category", "Price", "Active on Site", "Site URL", "Main Image", "Media Status", "Source URL", "Rights Status", "Last Sync"];
  const rows = products.map((p) => [p.id, p.name, (p.tags || [])[0] || "", p.category, p.price, p.active, productSiteUrl(p.slug), p.main_image_url, p.media_status, p.source_url, p.rights_status, p.sheet_synced_at || p.updated_at]);
  await sheets.clear([`${MIRROR}!A1:BK2000`]);
  await sheets.batch([{range: `${MIRROR}!A1`, values: [h, ...rows]}], "RAW");
}

function productSiteUrl(slug) {
  const base = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "";
  return base && slug ? `${base.replace(/\/$/, "")}/products/${slug}` : slug ? `/products/${slug}` : "";
}

function unique(values) {
  return [...new Set(values)];
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function quoteSheet(name) {
  return `'${String(name).replaceAll("'", "''")}'`;
}

function col(n) {
  let s = "";
  while (n) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
