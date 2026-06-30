import { GoogleSheetsClient } from "../../scripts/lib/google-sheets-client.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { categories } from "@/lib/config";
import type { Product } from "@/lib/types";

const DEFAULT_PRODUCT_SHEET_ID = "14L2liBREJYQSO_rhaAon_1RXonZIah91y77f4T3ctXs";
const DEFAULT_CHATS_SHEET = "chats list";
const protectedTermPattern =
  /\b(oral\s*-?b|oxo|festool|boveda|airtag|skadis|hanson|juwel|totoro|aquatlantis|gardena|altoids|gaahleri|central\s*pneumatic|gorilla\s*glue|titebond|bison|bambulab|cricut|silhouette|stampin|iroshizuku|craft\s*smart|aqueon|seaoura|milwaukee|ryobi|citadel|games\s*workshop|dewalt|makita|bosch|craftsman|stanley|dremel|samsung|galaxy|akg|lg|sony|scrub\s*daddy|dr\.?\s*squatch|softsoap|groot|vallejo|army\s*painter|toolgrid|multiboard|monster\s*energy|magsafe|nintendo|switch|xbox|playstation|ps5|ps4|mario|pokemon|disney|marvel|star\s*wars|lego|ikea|tesla|apple|iphone|ipad|airpods|dyson|nike|adidas|yeti|hydro\s*flask|gridfinity|barbie|hello\s*kitty|snoopy|minecraft|fortnite|roblox)\b/i;

type SupabaseAdmin = SupabaseClient;

type ChatsListSeedResult = {
  checked: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  failures: string[];
};

type ChatsRow = {
  rowNumber: number;
  product: string;
  status: string;
  category: string;
  price: string;
  score: number;
  confidence: number;
  sourceUrl: string;
  creator: string;
  license: string;
  commercialUse: string;
  attributionRequired: string;
  modificationRules: string;
  shortDescription: string;
  sellingBlurb: string;
  tags: string;
  differentiation: string;
  nextAction: string;
  personalization: string;
};

type MakerWorldDesign = {
  id?: number;
  title?: string;
  slug?: string;
  coverUrl?: string;
  coverPortrait?: string;
  summary?: string;
  license?: string;
  allowReCreation?: boolean;
  tags?: string[];
  designCreator?: { name?: string; handle?: string };
  designExtension?: {
    design_pictures?: Array<{ url?: string }>;
  };
  instances?: Array<{
    cover?: string;
    prediction?: number;
    weight?: number;
    pictures?: Array<{ url?: string }>;
    instanceFilaments?: Array<{ type?: string; usedG?: string; color?: string }>;
    extention?: {
      modelInfo?: {
        plates?: Array<{
          thumbnail?: { url?: string };
          pick_picture?: { url?: string };
        }>;
      };
    };
  }>;
};

type MakerWorldSearchHit = {
  id?: number;
  title?: string;
  slug?: string;
  likeCount?: number;
  collectionCount?: number;
  printCount?: number;
  downloadCount?: number;
};

type MakerWorldSearchResponse = {
  hits?: MakerWorldSearchHit[];
};

type VerifiedMakerWorld = {
  modelId: string;
  title: string;
  creator: string;
  license: string;
  licenseUrl: string | null;
  commercialUseAllowed: boolean;
  attributionRequired: boolean;
  modificationAllowed: boolean;
  shareAlikeRequired: boolean;
  sourceUrl: string;
  images: string[];
  tags: string[];
  summary: string;
  material: string;
  estimatedGrams: number | null;
  estimatedPrintHours: number | null;
};

export async function seedChatsListProductDrafts({
  limit = 20,
  supabase,
}: {
  limit?: number;
  supabase: SupabaseAdmin;
}): Promise<ChatsListSeedResult> {
  const empty = (): ChatsListSeedResult => ({ checked: 0, created: 0, updated: 0, skipped: 0, failed: 0, failures: [] });
  if (process.env.PRINTZ_ENABLE_CHATS_LIST_SEEDING === "false") return empty();

  const spreadsheetId = process.env.PRINTZ_PRODUCT_SHEET_ID || DEFAULT_PRODUCT_SHEET_ID;
  const sheetName = process.env.PRINTZ_CHATS_LIST_SHEET_NAME || DEFAULT_CHATS_SHEET;
  const sheets = new GoogleSheetsClient({ spreadsheetId, env: process.env });
  const values = await sheets.getValues(`${quoteSheetName(sheetName)}!A1:AQ1000`);
  const rows = parseChatsRows(values)
    .filter((row) => !isClearlyBlocked(row))
    .filter((row) => !hasTrademarkRisk([row.product, row.category, row.tags, row.sellingBlurb, row.sourceUrl].join(" ")))
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
    .slice(0, Math.max(1, Math.min(limit * 5, 500)));

  const result = empty();
  for (const row of rows) {
    if (result.created >= limit) break;
    result.checked++;

    try {
      const source = await resolveMakerWorldSource(row);
      if (!source.commercialUseAllowed) {
        result.skipped++;
        continue;
      }
      if (hasTrademarkRisk([row.product, source.title, source.sourceUrl, source.tags.join(" ")].join(" "))) {
        result.skipped++;
        continue;
      }

      const existing = await findExistingProduct(row, supabase);
      if (existing?.etsy_listing_id || existing?.etsy_url) {
        await updateRightsMetadata(existing.id, row, source, supabase);
        result.skipped++;
        continue;
      }

      if (existing) {
        await updateExistingProduct(existing as Product & { id: string }, row, source, supabase);
        result.updated++;
      } else {
        await createProduct(row, source, supabase);
        result.created++;
      }
    } catch (error) {
      result.failed++;
      result.failures.push(`${row.product}: ${error instanceof Error ? error.message : "Unknown Chats List seed error"}`);
    }
  }

  return result;
}

async function resolveMakerWorldSource(row: ChatsRow) {
  if (row.sourceUrl.includes("makerworld.com")) return verifyMakerWorld(row.sourceUrl);

  const sourceUrl = await findMakerWorldSourceUrl(row);
  if (!sourceUrl) throw new Error("No MakerWorld source found for Chats List row.");
  return verifyMakerWorld(sourceUrl);
}

function parseChatsRows(values: unknown[][]): ChatsRow[] {
  const [headerRow, ...body] = values;
  const headers = (headerRow || []).map((value) => normalizeHeader(String(value || "")));
  return body
    .map((row, index) => {
      const get = (...aliases: string[]) => valueFor(headers, row, aliases);
      const product = get("product", "name", "title");
      if (!product) return null;
      return {
        rowNumber: index + 2,
        product,
        status: get("status"),
        category: get("category"),
        price: get("recommended price", "price"),
        score: numberFromText(get("opportunity score", "score")) || 0,
        confidence: numberFromText(get("confidence")) || 0,
        sourceUrl: get("model link", "source url", "makerworld link", "model source"),
        creator: get("creator"),
        license: get("license"),
        commercialUse: get("commercial use", "can sell"),
        attributionRequired: get("attribution required"),
        modificationRules: get("modification rules"),
        shortDescription: get("short description"),
        sellingBlurb: get("selling blurb"),
        tags: get("tags"),
        differentiation: get("differentiation"),
        nextAction: get("next action"),
        personalization: get("personalization"),
      } satisfies ChatsRow;
    })
    .filter((row): row is ChatsRow => Boolean(row));
}

function valueFor(headers: string[], row: unknown[], aliases: string[]) {
  for (const alias of aliases.map(normalizeHeader)) {
    const index = headers.indexOf(alias);
    if (index >= 0) {
      const value = String(row[index] || "").replace(/\s+/g, " ").trim();
      if (value) return value;
    }
  }
  return "";
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isClearlyBlocked(row: ChatsRow) {
  const text = `${row.status} ${row.license} ${row.commercialUse} ${row.modificationRules}`.toLowerCase();
  if (/\b(non[\s-]?commercial|cc[\s-]?by[\s-]?nc|\bnc\b|cannot sell|do not sell|no commercial|rejected)\b/i.test(text)) return true;
  if (/needs license review|pending exact license|pending verification|do not sell until/i.test(text)) return true;
  return false;
}

function hasTrademarkRisk(value: string) {
  if (/[^\x00-\x7F]/.test(value) || protectedTermPattern.test(value)) return true;
  return /\b(stanley|nintendo|switch|xbox|playstation|ps5|ps4|mario|pokemon|pok[eé]mon|disney|marvel|star wars|lego|ikea|tesla|apple|iphone|ipad|airpods|dyson|nike|adidas|yeti|hydro\s*flask|gridfinity)\b/i.test(value);
}

async function findMakerWorldSourceUrl(row: ChatsRow) {
  const queries = makerWorldSearchQueries(row);
  const seen = new Set<string>();
  const candidates: Array<{ source: VerifiedMakerWorld; score: number }> = [];

  for (const query of queries) {
    const url = new URL("https://api.bambulab.com/v1/search-service/select/design2");
    url.searchParams.set("keyword", query);
    url.searchParams.set("limit", "8");

    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "PRINTZ automation" },
      cache: "no-store",
    });
    if (!response.ok) continue;

    const payload = (await response.json()) as MakerWorldSearchResponse;
    for (const hit of payload.hits || []) {
      if (!hit.id) continue;
      const sourceUrl = makerWorldSourceUrl(hit);
      if (seen.has(sourceUrl)) continue;
      seen.add(sourceUrl);

      const source = await verifyMakerWorld(sourceUrl).catch(() => null);
      if (!source?.commercialUseAllowed || !source.images.length) continue;
      if (!sourceLooksRelated(row, source, hit)) continue;
      if (hasTrademarkRisk([row.product, source.title, source.sourceUrl, source.tags.join(" ")].join(" "))) continue;
      candidates.push({ source, score: makerWorldCandidateScore(row, source, hit) });
    }

    if (candidates.length) break;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.source.sourceUrl || "";
}

function makerWorldSearchQueries(row: ChatsRow) {
  return normalizeList([
    row.product,
    [row.product, row.category].filter(Boolean).join(" "),
    splitList(row.tags).slice(0, 4).join(" "),
  ])
    .map((query) => query.replace(/\b(custom|personalized|printable|3d printed|gift)\b/gi, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function makerWorldSourceUrl(hit: MakerWorldSearchHit) {
  const slug = hit.slug ? `-${hit.slug}` : "";
  return `https://makerworld.com/en/models/${hit.id}${slug}?from=search`;
}

function sourceLooksRelated(row: ChatsRow, source: VerifiedMakerWorld, hit: MakerWorldSearchHit) {
  const rowWords = significantWords([row.product, row.category, row.tags].join(" "));
  const sourceWords = significantWords([source.title, hit.title, hit.slug].join(" "));
  if (!rowWords.length || !sourceWords.length) return true;
  return rowWords.some((word) => sourceWords.includes(word));
}

function makerWorldCandidateScore(row: ChatsRow, source: VerifiedMakerWorld, hit: MakerWorldSearchHit) {
  const textScore = significantWords([row.product, row.tags].join(" ")).filter((word) => significantWords([source.title, hit.title, hit.slug].join(" ")).includes(word)).length * 1000;
  const engagement = Number(hit.printCount || 0) * 2 + Number(hit.downloadCount || 0) + Number(hit.collectionCount || 0) * 0.5 + Number(hit.likeCount || 0) * 0.25;
  const licenseBoost = source.attributionRequired ? 0 : 250;
  return textScore + engagement + licenseBoost;
}

async function verifyMakerWorld(sourceUrl: string): Promise<VerifiedMakerWorld> {
  const modelId = makerWorldModelId(sourceUrl);
  if (!modelId) throw new Error("Could not parse MakerWorld model id.");

  const response = await fetch(`https://api.bambulab.com/v1/design-service/design/${modelId}`, {
    headers: { accept: "application/json", "user-agent": "PRINTZ automation" },
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MakerWorld API returned ${response.status}: ${text.slice(0, 160)}`);

  const design = JSON.parse(text) as MakerWorldDesign;
  const license = String(design.license || "").trim();
  const licenseInfo = licenseClassification(license);
  const creator = design.designCreator?.name || design.designCreator?.handle || "";
  const instance = design.instances?.[0];
  const filament = instance?.instanceFilaments?.[0];
  const usedG = numberFromText(String(filament?.usedG || ""));
  const prediction = Number(instance?.prediction || 0);

  return {
    modelId,
    title: cleanText(design.title || ""),
    creator,
    license,
    licenseUrl: licenseInfo.url,
    commercialUseAllowed: licenseInfo.commercial && !/nc/i.test(license),
    attributionRequired: licenseInfo.attribution,
    modificationAllowed: licenseInfo.modification,
    shareAlikeRequired: licenseInfo.shareAlike,
    sourceUrl,
    images: makerWorldImages(design).slice(0, 5),
    tags: normalizeList([...(design.tags || [])]).slice(0, 10),
    summary: htmlToText(design.summary || ""),
    material: filament?.type || "PLA or PETG",
    estimatedGrams: usedG,
    estimatedPrintHours: prediction > 0 ? Math.round((prediction / 3600) * 100) / 100 : null,
  };
}

function makerWorldImages(design: MakerWorldDesign) {
  const images = [
    design.coverUrl,
    design.coverPortrait,
    ...(design.designExtension?.design_pictures || []).map((item) => item.url),
    ...(design.instances || []).flatMap((instance) => [
      instance.cover,
      ...(instance.pictures || []).map((item) => item.url),
      ...(instance.extention?.modelInfo?.plates || []).flatMap((plate) => [plate.thumbnail?.url, plate.pick_picture?.url]),
    ]),
  ];
  return Array.from(new Set(images.filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)))));
}

function licenseClassification(license: string) {
  const normalized = license.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("nc")) return { commercial: false, attribution: true, modification: false, shareAlike: false, url: null };
  if (normalized.includes("cc0") || normalized === "0") {
    return { commercial: true, attribution: false, modification: true, shareAlike: false, url: "https://creativecommons.org/publicdomain/zero/1.0/" };
  }
  if (normalized.includes("by-sa") || normalized.includes("bysa")) {
    return { commercial: true, attribution: true, modification: true, shareAlike: true, url: "https://creativecommons.org/licenses/by-sa/4.0/" };
  }
  if (normalized.includes("by-nd") || normalized.includes("bynd")) {
    return { commercial: true, attribution: true, modification: false, shareAlike: false, url: "https://creativecommons.org/licenses/by-nd/4.0/" };
  }
  if (normalized.includes("by")) {
    return { commercial: true, attribution: true, modification: true, shareAlike: false, url: "https://creativecommons.org/licenses/by/4.0/" };
  }
  return { commercial: false, attribution: true, modification: false, shareAlike: false, url: null };
}

async function findExistingProduct(row: ChatsRow, supabase: SupabaseAdmin) {
  const bySource = row.sourceUrl
    ? await supabase.from("products").select("*").eq("source_url", row.sourceUrl).maybeSingle()
    : { data: null, error: null };
  if (bySource.error) throw bySource.error;
  if (bySource.data) return bySource.data;

  const byName = await supabase.from("products").select("*").eq("name", row.product).maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data;
}

async function createProduct(row: ChatsRow, source: VerifiedMakerWorld, supabase: SupabaseAdmin) {
  const slug = await uniqueSlug(slugify(row.product), supabase);
  const payload = productPayload(row, source, slug);
  const { data, error } = await supabase.from("products").insert(payload).select("id").single();
  if (error) throw error;
  await replaceMedia(data.id, source.images, supabase);
}

async function updateExistingProduct(product: Product & { id: string }, row: ChatsRow, source: VerifiedMakerWorld, supabase: SupabaseAdmin) {
  const patch = productPayload(row, source, product.slug || slugify(row.product), product);
  const { error } = await supabase.from("products").update(patch).eq("id", product.id);
  if (error) throw error;
  await replaceMedia(product.id, source.images, supabase);
}

async function updateRightsMetadata(productId: string, row: ChatsRow, source: VerifiedMakerWorld, supabase: SupabaseAdmin) {
  const patch = rightsPayload(row, source);
  const { error } = await supabase.from("products").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", productId);
  if (error) throw error;
}

function productPayload(row: ChatsRow, source: VerifiedMakerWorld, slug: string, existing?: Product) {
  const price = priceFromRange(row.price) || existing?.price || defaultPriceForCategory(row.category);
  const tags = etsyTags(row, source);
  const title = row.product.slice(0, 105);
  return {
    name: title,
    slug,
    short_description: (existing?.short_description && existing.short_description.length > 70 ? existing.short_description : row.shortDescription || row.sellingBlurb || `${title} made to order by PRINTZ.`).slice(0, 280),
    full_description: fullDescription(row, source, title),
    category: normalizeCategory(row.category),
    price,
    etsy_url: existing?.etsy_url || null,
    main_image_url: source.images[0] || existing?.main_image_url || null,
    video_url: existing?.video_url || null,
    materials: materials(row, source),
    dimensions: existing?.dimensions || "Final dimensions depend on selected size/profile. Confirm exact size before publishing or printing.",
    customization_notes: row.differentiation || row.personalization || "Choose available color, size, and finish options before production.",
    personalization_enabled: /custom|personal|name|photo|text|initial/i.test(`${row.product} ${row.personalization} ${row.sellingBlurb}`),
    personalization_prompt: /custom|personal|name|photo|text|initial/i.test(`${row.product} ${row.personalization} ${row.sellingBlurb}`)
      ? "Enter the name, text, color, size, or custom details for this order."
      : null,
    color_options: ["Black", "White", "Red", "Blue", "Green", "Custom color"],
    size_options: ["Standard", "Custom size"],
    finish_options: ["Standard"],
    processing_time: "Made to order in 2-4 business days",
    care_instructions: "Keep away from high heat. Clean gently with a dry or slightly damp cloth. Layer lines and small surface variations are normal for 3D printed items.",
    source_url: source.sourceUrl,
    license_notes: licenseNotes(row, source),
    tags,
    featured: existing?.featured || false,
    active: existing?.active || false,
    workflow_status: "Draft Ready",
    rights_status: rightsStatus(source),
    media_status: source.images.length ? "Ready" : "Missing",
    pricing_status: "Ready",
    source_platform: "MakerWorld",
    creator_name: source.creator || row.creator || null,
    license_type: source.license ? licenseLabel(source.license) : row.license || null,
    license_url: source.licenseUrl,
    commercial_sale_allowed: source.commercialUseAllowed,
    modification_allowed: source.modificationAllowed,
    attribution_required: source.attributionRequired,
    share_alike_required: source.shareAlikeRequired,
    attribution_text: source.attributionRequired && source.creator ? attributionText(row, source) : null,
    rights_reviewed_at: new Date().toISOString(),
    estimated_grams: source.estimatedGrams,
    estimated_print_hours: source.estimatedPrintHours,
    updated_at: new Date().toISOString(),
  };
}

function rightsPayload(row: ChatsRow, source: VerifiedMakerWorld) {
  return {
    source_platform: "MakerWorld",
    creator_name: source.creator || row.creator || null,
    license_type: source.license ? licenseLabel(source.license) : row.license || null,
    license_url: source.licenseUrl,
    license_notes: licenseNotes(row, source),
    rights_status: rightsStatus(source),
    commercial_sale_allowed: source.commercialUseAllowed,
    modification_allowed: source.modificationAllowed,
    attribution_required: source.attributionRequired,
    share_alike_required: source.shareAlikeRequired,
    attribution_text: source.attributionRequired && source.creator ? attributionText(row, source) : null,
    rights_reviewed_at: new Date().toISOString(),
  };
}

async function replaceMedia(productId: string, images: string[], supabase: SupabaseAdmin) {
  const imageRows = images.slice(0, 10).map((url, index) => ({ product_id: productId, media_type: "image", url, sort_order: index }));
  if (!imageRows.length) return;
  const { error: deleteError } = await supabase.from("product_media").delete().eq("product_id", productId);
  if (deleteError) throw deleteError;
  const { error } = await supabase.from("product_media").insert(imageRows);
  if (error) throw error;
}

function fullDescription(row: ChatsRow, source: VerifiedMakerWorld, title: string) {
  return [
    row.sellingBlurb || row.shortDescription || `${title} is a made-to-order 3D printed product selected from PRINTZ product research.`,
    row.shortDescription && row.shortDescription !== row.sellingBlurb ? row.shortDescription : "",
    `Materials: ${materials(row, source)}.`,
    "What to expect: made-to-order 3D printed products can have visible layer lines and small finish variations.",
    row.differentiation ? `Options: ${row.differentiation}` : "",
    sourceLicenseSummary(row, source),
  ].filter(Boolean).join("\n\n").slice(0, 5000);
}

function materials(row: ChatsRow, source: VerifiedMakerWorld) {
  const text = `${row.product} ${row.category}`.toLowerCase();
  if (text.includes("cookie") || text.includes("food")) {
    return "PLA/PETG 3D printed plastic. Use food-contact-safe production handling only when marketed for food use.";
  }
  if (text.includes("lamp")) return "PLA/PETG 3D printed shell; lighting hardware only if explicitly included.";
  return `${source.material || "PLA or PETG"} 3D printed plastic`;
}

function licenseNotes(row: ChatsRow, source: VerifiedMakerWorld) {
  const restrictions = [
    source.attributionRequired ? "attribution required" : "attribution optional",
    source.modificationAllowed ? "modifications allowed" : "no derivatives / sell unmodified only",
    source.shareAlikeRequired ? "share-alike applies to adaptations" : "",
  ].filter(Boolean).join("; ");
  return [
    `MakerWorld source verified by Bambu design-service API. License shown as ${licenseLabel(source.license)}.`,
    restrictions,
    source.creator ? `Attribution: ${source.title || row.product} by ${source.creator} on MakerWorld.` : "",
    row.modificationRules ? `Sheet notes: ${row.modificationRules}` : "",
  ].filter(Boolean).join(" ");
}

function sourceLicenseSummary(row: ChatsRow, source: VerifiedMakerWorld) {
  const attribution = source.attributionRequired && source.creator
    ? `Attribution: ${attributionText(row, source)}`
    : `Source model by ${source.creator || "a MakerWorld creator"} on MakerWorld. License: ${licenseLabel(source.license)}.`;
  const terms = [
    source.attributionRequired ? "Attribution is required and included in the Etsy listing." : "Attribution is optional under this license.",
    source.modificationAllowed ? "Commercial sale and print-setting/color adjustments are allowed." : "Sell unmodified only; do not publish modified/remixed model files.",
    source.shareAlikeRequired ? "Share-alike terms apply to adaptations." : "",
  ].filter(Boolean).join(" ");
  return `${attribution} ${terms}`;
}

function attributionText(row: ChatsRow, source: VerifiedMakerWorld) {
  return [
    `"${source.title || row.product}" by ${source.creator}`,
    `Source: ${source.sourceUrl}`,
    `License: ${licenseLabel(source.license)}${source.licenseUrl ? ` - ${source.licenseUrl}` : ""}`,
    `Changes / use: ${sourceChangeStatement(source)}`,
  ].join(". ");
}

function sourceChangeStatement(source: VerifiedMakerWorld) {
  const license = licenseLabel(source.license).toLowerCase();
  if (license.includes("cc0")) {
    return "physical 3D printed item made by PRINTZ By Khan from the source model; attribution is not required under CC0";
  }
  if (!source.modificationAllowed || license.includes("by-nd")) {
    return "physical 3D printed item made by PRINTZ By Khan from the unmodified source model; color, material, scale, and print settings may vary; no modified model files are redistributed";
  }
  if (source.shareAlikeRequired || license.includes("by-sa")) {
    return "physical 3D printed item made by PRINTZ By Khan; color, material, scale, and print-setting adjustments may be used; adaptations remain subject to share-alike terms where applicable; no digital model files are redistributed";
  }
  return "physical 3D printed item made by PRINTZ By Khan; color, material, scale, and print-setting adjustments may be used; no digital model files are redistributed";
}

function rightsStatus(source: VerifiedMakerWorld) {
  if (!source.commercialUseAllowed) return "Needs Review";
  if (source.shareAlikeRequired) return "Commercial OK with attribution and share-alike";
  if (source.attributionRequired && !source.modificationAllowed) return "Commercial OK with attribution; no derivatives";
  if (source.attributionRequired) return "Commercial OK with attribution";
  return "Commercial OK";
}

function etsyTags(row: ChatsRow, source: VerifiedMakerWorld) {
  return normalizeList([
    ...splitList(row.tags),
    row.product,
    row.category,
    ...source.tags,
    "3d printed",
    "custom gift",
    "made to order",
  ])
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim())
    .filter((tag) => tag && tag.length <= 20)
    .slice(0, 13);
}

function normalizeCategory(value: string) {
  const text = value.toLowerCase();
  const exact = categories.find((category) => category.toLowerCase() === text);
  if (exact) return exact;
  if (text.includes("decor") || text.includes("home") || text.includes("planter")) return "Decor";
  if (text.includes("desk") || text.includes("gaming") || text.includes("teacher")) return "Desk Accessories";
  if (text.includes("collect") || text.includes("toy")) return "Collectibles";
  if (text.includes("custom") || text.includes("personal") || text.includes("gift")) return "Custom Orders";
  return "Functional Prints";
}

function defaultPriceForCategory(category: string) {
  const text = category.toLowerCase();
  if (text.includes("decor") || text.includes("planter")) return 29.99;
  if (text.includes("kitchen") || text.includes("baking")) return 19.99;
  if (text.includes("pet")) return 17.99;
  return 14.99;
}

async function uniqueSlug(baseSlug: string, supabase: SupabaseAdmin) {
  const base = (baseSlug || "printz-product").slice(0, 190);
  for (let attempt = 0; attempt < 20; attempt++) {
    const slug = attempt ? `${base}-${attempt + 1}` : base;
    const { data, error } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return slug;
  }
  return `${base}-${Date.now()}`;
}

function makerWorldModelId(url: string) {
  return url.match(/makerworld\.com\/[^/]+\/models\/([0-9]+)/i)?.[1] || "";
}

function priceFromRange(value: string) {
  const numbers = Array.from(value.matchAll(/[0-9]+(?:\.[0-9]{1,2})?/g))
    .map((match) => Number(match[0]))
    .filter((number) => Number.isFinite(number) && number > 0);
  return numbers.length ? Math.max(...numbers) : null;
}

function numberFromText(value: string) {
  const match = value.match(/[0-9]+(?:\.[0-9]+)?/);
  const number = match ? Number(match[0]) : NaN;
  return Number.isFinite(number) ? number : null;
}

function licenseLabel(value: string) {
  const normalized = value.trim();
  if (/^cc0$/i.test(normalized)) return "CC0 1.0";
  if (/^by$/i.test(normalized)) return "CC BY 4.0";
  if (/^by-sa$/i.test(normalized)) return "CC BY-SA 4.0";
  if (/^by-nd$/i.test(normalized)) return "CC BY-ND 4.0";
  return normalized;
}

function htmlToText(value: string) {
  return cleanText(value.replace(/<[^>]*>/g, " "));
}

function cleanText(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function splitList(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

function normalizeList(values: string[]) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function significantWords(value: string) {
  const stop = new Set(["and", "the", "with", "for", "style", "printed", "printz", "custom", "personalized", "gift"]);
  return value
    .toLowerCase()
    .replace(/\b(headset|headphone|headphones)\b/g, "audio")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stop.has(word));
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 220);
}

function quoteSheetName(name: string) {
  return `'${name.replaceAll("'", "''")}'`;
}
