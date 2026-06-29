import { revalidatePath } from "next/cache";
import { seedChatsListProductDrafts } from "@/lib/chats-list-drafts";
import { createOrSyncEtsyListing, etsyListingRequirements } from "@/lib/etsy-listings";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken } from "@/lib/etsy-auth";
import { getEtsyReadiness } from "@/lib/etsy-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Product, ProductMedia } from "@/lib/types";

export type EtsyDraftAutomationResult = {
  ok: boolean;
  message: string;
  checked: number;
  created: number;
  skipped: number;
  failed: number;
  failures: string[];
  chatsListSeed?: {
    checked: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
};

export async function createMissingEtsyDrafts({
  dryRun = false,
  limit = 20,
}: {
  dryRun?: boolean;
  limit?: number;
} = {}): Promise<EtsyDraftAutomationResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return emptyResult("Supabase service role key is required.", false);
  }

  const [etsyToken, settings] = await Promise.all([getValidEtsyOAuthToken(), getEffectiveEtsyRuntimeSettings()]);
  const accessToken = etsyToken?.access_token || process.env.ETSY_ACCESS_TOKEN || "";
  const chatsListSeed = await seedChatsListProductDrafts({ limit, supabase }).catch((error) => ({
    checked: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 1,
    failures: [error instanceof Error ? error.message : "Chats List product seeding failed."],
  }));

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("etsy_listing_id", null)
    .or("etsy_url.is.null,etsy_url.eq.")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) return emptyResult(error.message, false);

  const products = (data || []) as Product[];
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const product of products) {
    const media = await productMedia(supabase, product.id);
    const imageCount = media.filter((item) => item.media_type === "image").length + (product.main_image_url ? 1 : 0);
    const readiness = getEtsyReadiness(product, { imageCount });
    const requirements = etsyListingRequirements(product, { hasOAuthToken: Boolean(accessToken), settings });

    if (requirements.length || !readiness.readyToDraft || hasTrademarkRisk(product)) {
      skipped++;
      continue;
    }

    if (dryRun) {
      created++;
      continue;
    }

    try {
      const result = await createOrSyncEtsyListing({
        apiKey: process.env.ETSY_API_KEY!,
        accessToken,
        settings,
        product,
        media,
        publish: false,
      });
      const audit = await auditEtsyDraft({
        accessToken,
        apiKey: process.env.ETSY_API_KEY!,
        product,
        listingId: result.listingId,
        uploadedImages: result.uploadedImages,
      });

      const { error: updateError } = await supabase
        .from("products")
        .update({
          etsy_listing_id: result.listingId,
          etsy_url: result.url,
          etsy_state: result.state || "draft",
          active: audit.ok,
          workflow_status: audit.ok ? product.workflow_status || "Draft Ready" : "Needs Review",
          rights_status: audit.ok ? product.rights_status : "Needs Review",
          media_status: audit.imageCount > 0 ? product.media_status || "Ready" : "Needs Review",
          license_notes: appendAuditNote(product.license_notes, audit.note),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (updateError) throw updateError;
      created++;
    } catch (error) {
      failed++;
      failures.push(`${product.name}: ${error instanceof Error ? error.message : "Unknown Etsy draft error"}`);
    }
  }

  if (!dryRun && created) {
    safeRevalidatePath("/");
    safeRevalidatePath("/products");
    safeRevalidatePath("/admin");
    safeRevalidatePath("/admin/etsy");
  }

  return {
    ok: failed === 0,
    message: `${dryRun ? "Dry run found" : "Created/synced"} ${created} Etsy draft${created === 1 ? "" : "s"}. Skipped ${skipped}. Failed ${failed}. Chats List seed created ${chatsListSeed.created}, updated ${chatsListSeed.updated}, failed ${chatsListSeed.failed}.`,
    checked: products.length,
    created,
    skipped,
    failed,
    failures: [...(chatsListSeed.failures || []), ...failures],
    chatsListSeed: {
      checked: chatsListSeed.checked,
      created: chatsListSeed.created,
      updated: chatsListSeed.updated,
      skipped: chatsListSeed.skipped,
      failed: chatsListSeed.failed,
    },
  };
}

async function productMedia(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productId: string) {
  const { data } = await supabase
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  return (data || []) as ProductMedia[];
}

async function auditEtsyDraft({
  accessToken,
  apiKey,
  product,
  listingId,
  uploadedImages,
}: {
  accessToken: string;
  apiKey: string;
  product: Product;
  listingId: number;
  uploadedImages: number;
}) {
  const [images, listing] = await Promise.all([
    fetchEtsyJson<{ count?: number; results?: unknown[] }>(`https://api.etsy.com/v3/application/listings/${listingId}/images`, accessToken, apiKey),
    fetchEtsyJson<{
      description?: string;
      price?: { amount?: number; divisor?: number } | string | number;
      title?: string;
    }>(`https://api.etsy.com/v3/application/listings/${listingId}`, accessToken, apiKey),
  ]);

  const description = String(listing.description || "");
  const imageCount = images.count ?? images.results?.length ?? 0;
  const expectedPrice = Number(product.price || 0);
  const actualPrice = etsyPrice(listing.price);
  const checks = [
    imageCount > 0 ? `Images OK (${imageCount} on Etsy, ${uploadedImages} newly uploaded).` : "Needs review: Etsy returned 0 listing images.",
    description.length >= 250 ? "Description length OK." : "Needs review: Etsy description looks too short.",
    expectedPrice > 0 && actualPrice !== null && Math.abs(actualPrice - expectedPrice) < 0.01
      ? `Price OK ($${actualPrice.toFixed(2)}).`
      : `Needs review: price mismatch or unreadable Etsy price (site $${expectedPrice.toFixed(2)}, Etsy ${actualPrice === null ? "unknown" : `$${actualPrice.toFixed(2)}`}).`,
    product.source_url && description.includes(product.source_url) ? "Source URL included." : "Needs review: source URL missing from Etsy description.",
    product.license_type && description.includes(product.license_type) ? `License included (${product.license_type}).` : "Needs review: license text missing from Etsy description.",
    product.attribution_required
      ? hasCompleteAttribution(description, product)
        ? "Required attribution included."
        : "Needs review: required attribution details missing from Etsy description."
      : "Attribution not required or not provided.",
    sourceTitleLooksRelated(product) ? "Source title looks related to product title." : "Needs review: source title may not match product title.",
    hasTrademarkRisk(product) ? "Needs review: possible protected brand/trademark term detected." : "Trademark scan OK.",
  ];
  const ok = checks.every((check) => !check.startsWith("Needs review"));

  return {
    ok,
    imageCount,
    note: [
      `PRINTZ Etsy draft audit ${new Date().toISOString()}`,
      `Listing ${listingId}: ${ok ? "PASSED" : "NEEDS REVIEW"}.`,
      ...checks.map((check) => `- ${check}`),
    ].join("\n"),
  };
}

async function fetchEtsyJson<T>(url: string, accessToken: string, apiKey: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey },
    });
    const text = await response.text();
    if (response.ok) return JSON.parse(text) as T;
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`Etsy audit read failed with ${response.status}: ${text.slice(0, 240)}`);
    }
    await delay(750);
  }
  throw new Error("Etsy audit read failed.");
}

function hasTrademarkRisk(product: Product) {
  if (product.trademark_review_status === "Needs Review") return true;
  const text = [product.name, product.short_description, product.full_description, product.source_url, ...(product.tags || [])].join(" ");
  return /\b(stanley|nintendo|switch|xbox|playstation|ps5|ps4|mario|pokemon|pok[eé]mon|disney|marvel|star wars|lego|ikea|tesla|apple|iphone|ipad|airpods|dyson|nike|adidas|yeti|hydro\s*flask|gridfinity)\b/i.test(text);
}

function hasCompleteAttribution(description: string, product: Product) {
  return Boolean(
    product.creator_name &&
      product.source_url &&
      product.license_type &&
      description.includes(`Creator: ${product.creator_name}`) &&
      description.includes(product.source_url) &&
      description.includes(product.license_type) &&
      description.includes("Changes / use:"),
  );
}

function etsyPrice(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object" && "amount" in value && "divisor" in value) {
    const money = value as { amount?: number; divisor?: number };
    if (Number.isFinite(money.amount) && Number.isFinite(money.divisor) && money.divisor) {
      return Number(money.amount) / Number(money.divisor);
    }
  }
  return null;
}

function sourceTitleLooksRelated(product: Product) {
  const sourceTitle = String(product.attribution_text || "").split(/\s+by\s+/i)[0] || "";
  if (!sourceTitle || !product.source_url?.includes("makerworld.com")) return true;
  const productWords = significantWords(product.name);
  const sourceWords = significantWords(`${sourceTitle} ${product.source_url}`);
  if (!productWords.length || !sourceWords.length) return true;
  return productWords.some((word) => sourceWords.includes(word));
}

function significantWords(value: string) {
  const stop = new Set(["and", "the", "with", "for", "style", "printed", "printz", "holder", "stand", "mount", "wall"]);
  return value
    .toLowerCase()
    .replace(/\b(headset|headphone|headphones)\b/g, "audio")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stop.has(word));
}

function appendAuditNote(existing: string | null | undefined, note: string) {
  const prior = String(existing || "").replace(/\n\nPRINTZ Etsy draft audit [\s\S]*$/i, "").trim();
  return [prior, note].filter(Boolean).join("\n\n").slice(0, 4000);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyResult(message: string, ok: boolean): EtsyDraftAutomationResult {
  return {
    ok,
    message,
    checked: 0,
    created: 0,
    skipped: 0,
    failed: ok ? 0 : 1,
    failures: ok ? [] : [message],
  };
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Scheduled/local automation can run outside a Next request store.
  }
}
