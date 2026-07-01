import { createSupabaseAdminClient } from "../src/lib/supabase/server";
import { getValidEtsyOAuthToken, getEffectiveEtsyRuntimeSettings } from "../src/lib/etsy-auth";
import { productToEtsyDraft } from "../src/lib/etsy-drafts";
import { createOrSyncEtsyListing } from "../src/lib/etsy-listings";
import { getEtsyReadiness } from "../src/lib/etsy-readiness";
import type { Product, ProductMedia } from "../src/lib/types";

const targetCount = Number(process.argv[2] || process.env.PRINTZ_PUBLISH_COUNT || 5);
const batchTag = "first-publish-batch";
const adsTag = "etsy-ads-test";

const blockedTerms = [
  "airtag",
  "apple",
  "bambu",
  "bambulab",
  "cricut",
  "disney",
  "festool",
  "knipex",
  "lego",
  "mooncat",
  "nintendo",
  "oral-b",
  "oxo",
  "peptide",
  "pokemon",
  "skadis",
  "star wars",
  "totoro",
  "xbox",
  "poop",
  "vial",
  "laboratory",
  "pipe & tube",
  "m3",
];

type EtsyListing = {
  listing_id?: number;
  state?: string;
  title?: string;
  description?: string;
  price?: { amount?: number; divisor?: number } | string | number;
  shipping_profile_id?: number;
  taxonomy_id?: number;
  readiness_state_id?: number;
  return_policy_id?: number;
  tags?: string[];
};

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role key is required.");

  const token = await getValidEtsyOAuthToken();
  const accessToken = token?.access_token || process.env.ETSY_ACCESS_TOKEN || "";
  const apiKey = process.env.ETSY_API_KEY || "";
  const settings = await getEffectiveEtsyRuntimeSettings();
  if (!apiKey || !accessToken) throw new Error("Etsy API key and OAuth access token are required.");
  if (!settings.shopId || !settings.taxonomyId || !settings.shippingProfileId || !settings.readinessStateId) {
    throw new Error("Etsy shop, taxonomy, shipping profile, and readiness IDs are required.");
  }
  if (!settings.returnPolicyId) {
    throw new Error("Etsy return policy ID is required for active physical listings.");
  }

  const products = await loadBatchProducts(supabase);
  const selected = products.slice(0, targetCount);
  if (selected.length !== targetCount) throw new Error(`Only found ${selected.length} batch products for target ${targetCount}.`);

  const results = [];
  for (const { product, rank } of selected) {
    await delay(1500);
    const media = await productMedia(supabase, product.id);
    const validation = await validateProduct({ apiKey, accessToken, media, product, rank });
    if (!validation.ok) {
      results.push({ rank, product: product.name, published: false, errors: validation.errors });
      continue;
    }

    const sync = await withEtsyRetry(() => createOrSyncEtsyListing({ apiKey, accessToken, settings, product, media, publish: true }));
    await updatePublishedProduct(supabase, product.id, sync.listingId, sync.url);
    await delay(1500);
    const live = await fetchEtsyListing(apiKey, accessToken, sync.listingId);
    await delay(1000);
    const images = await fetchEtsyImageCount(apiKey, accessToken, sync.listingId);
    const postErrors = postPublishErrors(live, images, product, settings);
    results.push({
      rank,
      product: product.name,
      listingId: sync.listingId,
      url: sync.url,
      state: live.state,
      images,
      published: postErrors.length === 0,
      errors: postErrors,
    });
  }

  const failed = results.filter((result) => result.errors.length);
  console.log(JSON.stringify({ attempted: selected.length, published: results.filter((result) => result.published).length, failed: failed.length, results }, null, 2));
  if (failed.length) process.exit(1);
}

async function loadBatchProducts(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data, error } = await supabase.from("products").select("*").contains("tags", [batchTag]).limit(100);
  if (error) throw error;
  return ((data || []) as Product[])
    .map((product) => ({ product, rank: rankFor(product) }))
    .filter((item) => item.rank > 0)
    .sort((a, b) => a.rank - b.rank);
}

async function validateProduct({
  apiKey,
  accessToken,
  media,
  product,
  rank,
}: {
  apiKey: string;
  accessToken: string;
  media: ProductMedia[];
  product: Product;
  rank: number;
}) {
  const errors: string[] = [];
  const imageCount = imageCountFor(product, media);
  const readiness = getEtsyReadiness(product, { imageCount });
  const text = [product.name, product.category, product.short_description, product.full_description, product.license_notes, ...(product.tags || [])].join(" ").toLowerCase();

  if (rank > targetCount) errors.push(`Rank ${rank} is outside target ${targetCount}.`);
  if (!product.active) errors.push("Product is inactive on PRINTZ.");
  if (!product.tags?.includes(batchTag)) errors.push(`Missing ${batchTag} tag.`);
  if (rank <= 15 && !product.tags?.includes(adsTag)) errors.push(`Top ad-test product missing ${adsTag} tag.`);
  if ((product.sales_likelihood_score || 0) < 90) errors.push(`Sell score ${product.sales_likelihood_score || 0} is below publish threshold.`);
  if (!readiness.readyToPublish) errors.push(`PRINTZ readiness is not publish-ready: ${readiness.items.filter((item) => !item.ok).map((item) => item.label).join(", ")}`);
  if (imageCount < 5) errors.push(`Only ${imageCount} product images available.`);
  if (!product.etsy_listing_id) errors.push("No Etsy listing ID attached.");
  if (!product.etsy_url?.includes("etsy.com/listing/")) errors.push("No Etsy listing URL attached.");
  if (!product.source_url?.includes("makerworld.com")) errors.push("MakerWorld source URL is missing.");
  if (!product.license_notes?.toLowerCase().includes("license")) errors.push("License notes are missing license wording.");
  if (!product.license_notes?.toLowerCase().includes("source")) errors.push("License notes are missing source wording.");
  if (product.commercial_sale_allowed !== true) errors.push("Commercial sale is not explicitly allowed.");
  if (product.rights_status === "Needs Review" || product.media_status === "Needs Review" || product.trademark_review_status === "Needs Review") errors.push("Product is marked Needs Review.");
  const blocked = blockedTerms.filter((term) => text.includes(term));
  if (blocked.length) errors.push(`Blocked/risky terms present: ${blocked.join(", ")}.`);

  if (product.etsy_listing_id) {
    const live = await fetchEtsyListing(apiKey, accessToken, product.etsy_listing_id);
    const etsyImageCount = await fetchEtsyImageCount(apiKey, accessToken, product.etsy_listing_id);
    if (!["draft", "inactive", "active"].includes(String(live.state || ""))) errors.push(`Etsy listing state is ${live.state || "unknown"}, not draft/inactive/active.`);
    if (etsyImageCount < 5) errors.push(`Etsy listing has only ${etsyImageCount} images.`);
  }

  return { ok: errors.length === 0, errors };
}

async function updatePublishedProduct(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productId: string, listingId: number, url: string) {
  const { error } = await supabase
    .from("products")
    .update({
      active: true,
      etsy_listing_id: listingId,
      etsy_url: url,
      etsy_state: "active",
      synced_from_etsy_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", productId);
  if (error) throw error;
}

function postPublishErrors(
  listing: EtsyListing,
  imageCount: number,
  product: Product,
  settings: Awaited<ReturnType<typeof getEffectiveEtsyRuntimeSettings>>,
) {
  const errors: string[] = [];
  if (listing.state !== "active") errors.push(`Post-publish Etsy state is ${listing.state || "unknown"}.`);
  if (imageCount < 5) errors.push(`Post-publish Etsy image count is ${imageCount}.`);
  errors.push(...liveListingContentErrors(listing, product, settings));
  if (Number(listing.taxonomy_id || 0) !== Number(settings.taxonomyId)) errors.push(`Post-publish Etsy taxonomy is ${listing.taxonomy_id || "missing"}.`);
  if (Number(listing.shipping_profile_id || 0) !== Number(settings.shippingProfileId)) errors.push(`Post-publish Etsy shipping profile is ${listing.shipping_profile_id || "missing"}.`);
  if (Number(listing.readiness_state_id || 0) !== Number(settings.readinessStateId)) errors.push(`Post-publish Etsy readiness state is ${listing.readiness_state_id || "missing"}.`);
  if (Number(listing.return_policy_id || 0) !== Number(settings.returnPolicyId)) errors.push(`Post-publish Etsy return policy is ${listing.return_policy_id || "missing"}.`);
  return errors;
}

function liveListingContentErrors(
  listing: EtsyListing,
  product: Product,
  settings: Awaited<ReturnType<typeof getEffectiveEtsyRuntimeSettings>>,
) {
  const errors: string[] = [];
  const expected = productToEtsyDraft(product, settings.taxonomyId);
  const expectedTitle = expected.body.get("title") || "";
  const expectedDescription = expected.body.get("description") || "";
  const expectedTags = (expected.body.get("tags") || "").split(",").filter(Boolean);
  const liveDescription = String(listing.description || "");
  const normalizedLiveDescription = normalizeText(liveDescription);
  const normalizedExpectedDescription = normalizeText(expectedDescription);

  if (String(listing.title || "") !== expectedTitle) errors.push("Etsy title does not match the PRINTZ-generated title.");
  if (expectedTitle.length > 140) errors.push(`Generated Etsy title is too long: ${expectedTitle.length}/140.`);
  if (expectedTitle.length < 30) errors.push(`Generated Etsy title is very short: ${expectedTitle.length} characters.`);

  if (normalizedLiveDescription !== normalizedExpectedDescription) errors.push("Etsy description does not match the PRINTZ-generated description.");
  if (liveDescription.length < 900) errors.push(`Etsy description is too thin: ${liveDescription.length} characters.`);
  for (const section of ["Details:", "Materials:", "Dimensions:", "Processing time:", "Care:", "Notes:", "Source and license:"]) {
    if (!liveDescription.includes(section)) errors.push(`Etsy description is missing ${section}`);
  }
  for (const sourceField of ["Model:", "Creator:", "Platform: MakerWorld", "Source:", "License:", "Changes / use:", "Attribution notice:"]) {
    if (!liveDescription.includes(sourceField)) errors.push(`Etsy source attribution is missing ${sourceField}`);
  }
  if (product.source_url && !liveDescription.includes(product.source_url)) errors.push("Etsy description does not include the exact MakerWorld source URL.");
  if (product.creator_name && !liveDescription.toLowerCase().includes(product.creator_name.toLowerCase())) errors.push("Etsy description does not include the MakerWorld creator name.");
  if (product.license_type && !liveDescription.toLowerCase().includes(product.license_type.toLowerCase())) errors.push("Etsy description does not include the source license type.");

  const livePrice = typeof listing.price === "object" && listing.price
    ? Number(listing.price.amount || 0) / Number(listing.price.divisor || 1)
    : Number(listing.price || 0);
  const expectedPrice = Number(product.price || 9.99);
  if (Math.abs(livePrice - expectedPrice) > 0.01) errors.push(`Etsy price ${livePrice.toFixed(2)} does not match PRINTZ price ${expectedPrice.toFixed(2)}.`);

  const liveTags = (listing.tags || []).map((tag) => tag.toLowerCase());
  for (const tag of expectedTags) {
    if (!liveTags.includes(tag)) errors.push(`Etsy tags are missing ${tag}.`);
  }
  for (const internalTag of [batchTag, "first-publish-batch-2026-06-30", adsTag]) {
    if (liveTags.includes(internalTag)) errors.push(`Internal admin tag leaked to Etsy: ${internalTag}.`);
  }
  if (liveTags.length < 8) errors.push(`Etsy has only ${liveTags.length} tags.`);
  if (liveTags.some((tag) => tag.length > 20)) errors.push("Etsy has a tag longer than 20 characters.");

  return errors;
}

function normalizeText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

async function productMedia(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productId: string) {
  const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as ProductMedia[];
}

function imageCountFor(product: Product, media: ProductMedia[]) {
  return new Set([product.main_image_url, ...media.filter((item) => item.media_type === "image").map((item) => item.url)].filter(Boolean)).size;
}

function rankFor(product: Product) {
  const match = String(product.sales_likelihood_notes || "").match(/FIRST PUBLISH BATCH RANK\s+(\d+)\/50/i);
  return match ? Number(match[1]) : 0;
}

async function fetchEtsyListing(apiKey: string, accessToken: string, listingId: number) {
  return withEtsyRetry(async () => {
    const response = await fetch(`https://api.etsy.com/v3/application/listings/${listingId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Could not fetch Etsy listing ${listingId}: ${response.status} ${text.slice(0, 500)}`);
    return JSON.parse(text) as EtsyListing;
  });
}

async function fetchEtsyImageCount(apiKey: string, accessToken: string, listingId: number) {
  return withEtsyRetry(async () => {
    const response = await fetch(`https://api.etsy.com/v3/application/listings/${listingId}/images`, {
      headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Could not fetch Etsy listing images ${listingId}: ${response.status} ${text.slice(0, 500)}`);
    }
    const payload = (await response.json()) as { count?: number; results?: unknown[] };
    return payload.count ?? payload.results?.length ?? 0;
  });
}

async function withEtsyRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("429") && !message.toLowerCase().includes("rate limit")) throw error;
      await delay(2000 * attempt);
    }
  }
  throw lastError;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
