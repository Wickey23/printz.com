import type { Product, ProductMedia } from "@/lib/types";
import type { EtsyRuntimeSettings } from "@/lib/etsy-auth";
import { createEtsyDraftFromProduct, etsyDraftRequirements, productToEtsyDraft } from "@/lib/etsy-drafts";

export type EtsyListingSyncInput = {
  apiKey: string;
  accessToken: string;
  settings: EtsyRuntimeSettings;
  product: Product;
  media?: ProductMedia[];
  publish?: boolean;
};

export type EtsyListingSyncResult = {
  listingId: number;
  url: string;
  state: "draft" | "active" | string;
  uploadedImages: number;
  recreatedDraft?: boolean;
};

export function etsyListingRequirements(product: Product, options: { hasOAuthToken?: boolean; settings?: Partial<EtsyRuntimeSettings> } = {}) {
  return etsyDraftRequirements(product, options);
}

export async function createOrSyncEtsyListing({ apiKey, accessToken, settings, product, media = [], publish = false }: EtsyListingSyncInput): Promise<EtsyListingSyncResult> {
  let draft = product.etsy_listing_id
    ? { listingId: product.etsy_listing_id, url: product.etsy_url || `https://www.etsy.com/listing/${product.etsy_listing_id}` }
    : await createDraft(apiKey, accessToken, settings, product);
  let listingId = draft.listingId;
  let recreatedDraft = false;
  let createdDraft = !product.etsy_listing_id;

  try {
    if (!createdDraft || publish) await updateListing({ apiKey, accessToken, shopId: settings.shopId, listingId, product, settings, publish });
  } catch (error) {
    if (!(error instanceof EtsyApiError) || error.status !== 404 || !product.etsy_listing_id) throw error;
    draft = await createDraft(apiKey, accessToken, settings, product);
    listingId = draft.listingId;
    recreatedDraft = true;
    createdDraft = true;
    if (publish) await updateListing({ apiKey, accessToken, shopId: settings.shopId, listingId, product, settings, publish });
  }

  const uploadedImages = await syncListingImages({ apiKey, accessToken, shopId: settings.shopId, listingId, product, media });
  const url = product.etsy_listing_id === listingId && product.etsy_url ? product.etsy_url : draft.url || `https://www.etsy.com/listing/${listingId}`;
  return { listingId, url, state: publish ? "active" : product.etsy_state || "draft", uploadedImages, recreatedDraft };
}

async function createDraft(apiKey: string, accessToken: string, settings: EtsyRuntimeSettings, product: Product) {
  return createEtsyDraftFromProduct({
    apiKey,
    accessToken,
    shopId: settings.shopId,
    taxonomyId: settings.taxonomyId,
    shippingProfileId: settings.shippingProfileId,
    readinessStateId: settings.readinessStateId,
    returnPolicyId: settings.returnPolicyId,
    product,
  });
}

async function updateListing({
  apiKey,
  accessToken,
  shopId,
  listingId,
  product,
  settings,
  publish,
}: {
  apiKey: string;
  accessToken: string;
  shopId: string;
  listingId: number;
  product: Product;
  settings: EtsyRuntimeSettings;
  publish: boolean;
}) {
  const { body, isDigital } = productToEtsyDraft(product, settings.taxonomyId);
  if (!isDigital) {
    if (settings.shippingProfileId) body.set("shipping_profile_id", settings.shippingProfileId);
    if (settings.readinessStateId) body.set("readiness_state_id", settings.readinessStateId);
    if (settings.returnPolicyId) body.set("return_policy_id", settings.returnPolicyId);
  }
  if (publish) body.set("state", "active");

  const response = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": apiKey,
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) throw new EtsyApiError("Etsy listing update failed", response.status, text);
}

async function syncListingImages({
  apiKey,
  accessToken,
  shopId,
  listingId,
  product,
  media,
}: {
  apiKey: string;
  accessToken: string;
  shopId: string;
  listingId: number;
  product: Product;
  media: ProductMedia[];
}) {
  const imageUrls = orderedImageUrls(product, media).slice(0, 10);
  if (!imageUrls.length) return 0;

  const existing = await getListingImageCount({ apiKey, accessToken, shopId, listingId }).catch(() => 0);
  if (existing >= imageUrls.length) return 0;

  let uploaded = 0;
  for (const [index, url] of imageUrls.entries()) {
    const image = await downloadImage(url).catch(() => null);
    if (!image) continue;

    const body = new FormData();
    body.set("rank", String(index + 1));
    body.set("image", new Blob([image.bytes], { type: image.contentType }), image.fileName);

    const response = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/listings/${listingId}/images`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": apiKey,
      },
      body,
    });

    const text = await response.text();
    if (!response.ok) throw new EtsyApiError("Etsy image upload failed", response.status, text);
    uploaded++;
    await delay(250);
  }

  return uploaded;
}

async function getListingImageCount({ apiKey, accessToken, shopId, listingId }: { apiKey: string; accessToken: string; shopId: string; listingId: number }) {
  void shopId;
  const response = await fetch(`https://api.etsy.com/v3/application/listings/${listingId}/images`, {
    headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey },
  });
  if (!response.ok) return 0;
  const payload = (await response.json()) as { count?: number; results?: unknown[] };
  return payload.count ?? payload.results?.length ?? 0;
}

async function downloadImage(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not download image ${url}`);
  const headerContentType = response.headers.get("content-type") || "";
  const contentType = imageContentType(url, headerContentType);
  if (!contentType) throw new Error(`URL is not an image: ${url}`);
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType,
    fileName: fileNameFromUrl(url, contentType),
  };
}

function orderedImageUrls(product: Product, media: ProductMedia[]) {
  return Array.from(new Set([
    product.main_image_url,
    ...media.filter((item) => item.media_type === "image").sort((a, b) => a.sort_order - b.sort_order).map((item) => item.url),
  ].filter(Boolean) as string[]));
}

function fileNameFromUrl(url: string, contentType: string) {
  const pathname = new URL(url).pathname;
  const name = pathname.split("/").filter(Boolean).pop();
  if (name && /\.[a-z0-9]+$/i.test(name)) return name;
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return `printz-product-image.${ext}`;
}

class EtsyApiError extends Error {
  status: number;

  constructor(context: string, status: number, body: string) {
    const details = body.slice(0, 500);
    const message =
      status === 401 || status === 403 || body.toLowerCase().includes("scope")
        ? `${context}: Etsy needs an approved app and OAuth token with listings_w scope. Etsy returned ${status}: ${details}`
        : `${context}: ${status}: ${details}`;
    super(message);
    this.name = "EtsyApiError";
    this.status = status;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function imageContentType(url: string, headerContentType: string) {
  if (headerContentType.startsWith("image/")) return headerContentType;
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".webp")) return "image/webp";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  return "";
}
