import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getEffectiveEtsyRuntimeSettings } from "@/lib/etsy-auth";
import { slugify } from "@/lib/utils";

type EtsyMoney = {
  amount?: number;
  divisor?: number;
  currency_code?: string;
};

type EtsyImage = {
  listing_image_id?: number;
  url_fullxfull?: string;
  url_570xN?: string;
  url_300x300?: string;
  url_170x135?: string;
};

type EtsyListing = {
  listing_id: number;
  title?: string;
  description?: string;
  state?: string;
  url?: string;
  price?: EtsyMoney | string | number;
  tags?: string[];
  materials?: string[];
  taxonomy_path?: string[];
  is_digital?: boolean;
  quantity?: number;
  creation_timestamp?: number;
  created_timestamp?: number;
  last_modified_timestamp?: number;
  images?: EtsyImage[];
  Images?: EtsyImage[];
};

export type EtsySyncResult = {
  ok: boolean;
  message: string;
  imported: number;
  deactivated: number;
  mediaUpdated: number;
  mode: "active-only" | "shop-mirror";
  updatedAt: string;
};

export async function syncEtsyListings(options: { accessToken?: string | null } = {}): Promise<EtsySyncResult> {
  const apiKey = process.env.ETSY_API_KEY;
  const accessToken = options.accessToken || process.env.ETSY_ACCESS_TOKEN || "";
  const settings = await getEffectiveEtsyRuntimeSettings();
  const configuredShopId = settings.shopId;
  const shopName = process.env.ETSY_SHOP_NAME || "printzbykhan";
  const supabase = createSupabaseAdminClient();
  const updatedAt = new Date().toISOString();
  const emptyResult = {
    imported: 0,
    deactivated: 0,
    mediaUpdated: 0,
    mode: accessToken ? "shop-mirror" as const : "active-only" as const,
    updatedAt,
  };

  if (!supabase) {
    return { ok: false, message: "Supabase service role key is not configured.", ...emptyResult };
  }

  if (!apiKey) {
    return {
      ok: false,
      message: "ETSY_API_KEY is required before Etsy sync can run. It must be keystring:shared_secret from the Etsy developer app.",
      ...emptyResult,
    };
  }

  const shopId = configuredShopId || (await resolveShopId({ apiKey, shopName }));
  const syncMode = accessToken ? "shop-mirror" : "active-only";
  const listings = accessToken
    ? await fetchShopListingsByState({ accessToken, apiKey, shopId })
    : await fetchActiveEtsyListings({ apiKey, shopId });
  const activeListings = listings.filter((listing) => listing.state ? listing.state === "active" : true);

  if (!activeListings.length) {
    const deactivated = accessToken ? await deactivateInactiveEtsyProducts({ activeListings, allListings: listings, supabase, updatedAt }) : 0;
    return {
      ok: true,
      message: accessToken
        ? `No active Etsy listings returned. Deactivated ${deactivated} website product${deactivated === 1 ? "" : "s"} from Etsy state.`
        : "No active Etsy listings returned.",
      imported: 0,
      deactivated,
      mediaUpdated: 0,
      mode: syncMode,
      updatedAt,
    };
  }

  const rows = activeListings.map((listing) => mapListingToProduct(listing, updatedAt));
  const { data: upsertedProducts, error } = await supabase.from("products").upsert(rows, {
    onConflict: "etsy_listing_id",
    ignoreDuplicates: false,
  }).select("id, etsy_listing_id");

  if (error) {
    return { ok: false, message: error.message, imported: 0, deactivated: 0, mediaUpdated: 0, mode: syncMode, updatedAt };
  }

  const mediaUpdated = await replaceProductMediaFromEtsy({
    listings: activeListings,
    products: upsertedProducts || [],
    supabase,
  });
  const deactivated = accessToken ? await deactivateInactiveEtsyProducts({ activeListings, allListings: listings, supabase, updatedAt }) : 0;

  return {
    ok: true,
    message: [
      `Synced ${rows.length} active Etsy listing${rows.length === 1 ? "" : "s"}.`,
      mediaUpdated ? `Refreshed ${mediaUpdated} Etsy image${mediaUpdated === 1 ? "" : "s"} on the website.` : "",
      deactivated ? `Deactivated ${deactivated} non-active Etsy product${deactivated === 1 ? "" : "s"} on the website.` : "",
      syncMode === "active-only" ? "Connect OAuth or set ETSY_ACCESS_TOKEN for inactive/draft/sold-out mirroring." : "Full shop mirror mode used OAuth state checks.",
    ].filter(Boolean).join(" "),
    imported: rows.length,
    deactivated,
    mediaUpdated,
    mode: syncMode,
    updatedAt,
  };
}

async function resolveShopId({ apiKey, shopName }: { apiKey: string; shopName: string }) {
  const url = new URL("https://api.etsy.com/v3/application/shops");
  url.searchParams.set("shop_name", shopName);

  const response = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(etsyApiErrorMessage(`Could not resolve Etsy shop "${shopName}"`, response.status, body));
  }

  const payload = (await response.json()) as { results?: Array<{ shop_id?: number; shop_name?: string }>; shop_id?: number };
  const exactMatch = payload.results?.find((shop) => shop.shop_name?.toLowerCase() === shopName.toLowerCase());
  const shopId = exactMatch?.shop_id || payload.results?.[0]?.shop_id || payload.shop_id;

  if (!shopId) {
    throw new Error(`Could not find an Etsy shop_id for "${shopName}".`);
  }

  return String(shopId);
}

async function fetchActiveEtsyListings({ apiKey, shopId }: { apiKey: string; shopId: string }) {
  const listings: EtsyListing[] = [];
  let offset = 0;
  const limit = 100;

  while (offset < 500) {
    const url = new URL(`https://api.etsy.com/v3/application/shops/${shopId}/listings/active`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("includes", "Images");

    const response = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(etsyApiErrorMessage("Etsy sync failed", response.status, body));
    }

    const payload = (await response.json()) as { count?: number; results?: EtsyListing[] };
    const page = payload.results || [];
    listings.push(...page);

    if (page.length < limit || listings.length >= (payload.count || 0)) break;
    offset += limit;
  }

  return listings;
}

async function fetchShopListingsByState({ accessToken, apiKey, shopId }: { accessToken: string; apiKey: string; shopId: string }) {
  const states = ["active", "inactive", "sold_out", "draft", "expired"];
  const seen = new Set<number>();
  const listings: EtsyListing[] = [];

  for (const state of states) {
    const page = await fetchShopListings({ accessToken, apiKey, shopId, state });
    for (const listing of page) {
      if (seen.has(listing.listing_id)) continue;
      seen.add(listing.listing_id);
      listings.push({ ...listing, state: listing.state || state });
    }
  }

  return listings;
}

async function fetchShopListings({
  accessToken,
  apiKey,
  shopId,
  state,
}: {
  accessToken: string;
  apiKey: string;
  shopId: string;
  state: string;
}) {
  const listings: EtsyListing[] = [];
  let offset = 0;
  const limit = 100;

  while (offset < 1000) {
    const url = new URL(`https://api.etsy.com/v3/application/shops/${shopId}/listings`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("state", state);
    url.searchParams.set("includes", "Images");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-api-key": apiKey,
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(etsyApiErrorMessage(`Etsy ${state} listing sync failed`, response.status, body));
    }

    const payload = (await response.json()) as { count?: number; results?: EtsyListing[] };
    const page = payload.results || [];
    listings.push(...page);

    if (page.length < limit || listings.length >= (payload.count || 0)) break;
    offset += limit;
  }

  return listings;
}

async function replaceProductMediaFromEtsy({
  listings,
  products,
  supabase,
}: {
  listings: EtsyListing[];
  products: Array<{ id: string; etsy_listing_id: number | null }>;
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
}) {
  const productByListingId = new Map(products.map((product) => [Number(product.etsy_listing_id), product.id]));
  const productIds = products.map((product) => product.id).filter(Boolean);
  if (!productIds.length) return 0;

  await supabase.from("product_media").delete().in("product_id", productIds);

  const mediaRows = listings.flatMap((listing) => {
    const productId = productByListingId.get(listing.listing_id);
    if (!productId) return [];

    return listingImages(listing).map((url, index) => ({
      product_id: productId,
      media_type: "image",
      url,
      sort_order: index,
    }));
  });

  if (!mediaRows.length) return 0;
  const { error } = await supabase.from("product_media").insert(mediaRows);
  if (error) throw error;
  return mediaRows.length;
}

async function deactivateInactiveEtsyProducts({
  activeListings,
  allListings,
  supabase,
  updatedAt,
}: {
  activeListings: EtsyListing[];
  allListings: EtsyListing[];
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  updatedAt: string;
}) {
  const activeIds = new Set(activeListings.map((listing) => listing.listing_id));
  const inactiveListings = allListings.filter((listing) => !activeIds.has(listing.listing_id));
  if (!inactiveListings.length) return 0;

  let changed = 0;
  for (const listing of inactiveListings) {
    const { error, count } = await supabase
      .from("products")
      .update({
        active: false,
        featured: false,
        etsy_state: listing.state || "inactive",
        synced_from_etsy_at: updatedAt,
        updated_at: updatedAt,
      }, { count: "exact" })
      .eq("etsy_listing_id", listing.listing_id);

    if (error) throw error;
    changed += count || 0;
  }

  return changed;
}

function etsyApiErrorMessage(context: string, status: number, body: string) {
  const details = body.slice(0, 240);
  const normalized = body.toLowerCase();

  if (
    status === 401 ||
    status === 403 ||
    normalized.includes("not active") ||
    normalized.includes("api key not found")
  ) {
    return `${context}: Etsy rejected the API key. If the Etsy developer app is still pending approval, wait for Etsy to approve it, then run sync again. (${status} ${details})`;
  }

  return `${context}: ${status} ${details}`;
}

function mapListingToProduct(listing: EtsyListing, updatedAt: string) {
  const title = cleanText(listing.title || `Etsy listing ${listing.listing_id}`);
  const isDigital = Boolean(listing.is_digital) || digitalSignals(listing);
  const category = isDigital ? "Digital Products" : inferCategory(listing);
  const description = cleanText(listing.description || "");
  const shortDescription = summarize(description || `${title} from the PRINTZ Etsy shop.`);
  const price = parsePrice(listing.price);
  const mainImage = primaryImage(listing);
  const tags = Array.from(new Set([...(listing.tags || []), category.toLowerCase(), isDigital ? "digital download" : "3d printed"].map(cleanTag))).filter(Boolean).slice(0, 13);

  return {
    name: title,
    slug: `${slugify(title)}-${listing.listing_id}`,
    short_description: shortDescription,
    full_description: description || shortDescription,
    category,
    price,
    etsy_url: listing.url || `https://www.etsy.com/listing/${listing.listing_id}`,
    main_image_url: mainImage,
    video_url: null,
    materials: listing.materials?.length ? listing.materials.join(", ") : isDigital ? "Digital download files" : "See Etsy listing",
    dimensions: null,
    customization_notes: isDigital ? "Instant digital download through Etsy." : "Order options and color choices are managed on Etsy.",
    personalization_enabled: !isDigital && textIncludesPersonalization(listing),
    personalization_prompt: !isDigital && textIncludesPersonalization(listing) ? "Add the name, initials, color, size, or custom request in Etsy personalization/order notes." : null,
    color_options: !isDigital ? inferColorOptions(listing) : [],
    size_options: [],
    finish_options: !isDigital ? inferFinishOptions(listing) : [],
    processing_time: isDigital ? "Available instantly after Etsy checkout" : "Made to order. See Etsy listing for the current processing time.",
    care_instructions: isDigital
      ? "Download and print using the included file instructions. Colors can vary by screen, printer, and paper."
      : "Keep 3D printed items away from high heat. Clean gently with a dry or slightly damp cloth.",
    source_url: null,
    license_notes: isDigital ? "Original PRINTZ digital product. Download is fulfilled through Etsy." : "Synced from the PRINTZ Etsy shop.",
    tags,
    featured: false,
    active: listing.state ? listing.state === "active" : true,
    etsy_listing_id: listing.listing_id,
    etsy_state: listing.state || "active",
    synced_from_etsy_at: updatedAt,
    updated_at: updatedAt,
  };
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanTag(value: string) {
  return cleanText(value).toLowerCase().slice(0, 40);
}

function summarize(value: string) {
  const clean = cleanText(value);
  if (clean.length <= 220) return clean;
  return `${clean.slice(0, 217).trim()}...`;
}

function parsePrice(value: EtsyListing["price"]) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value?.amount && value.divisor) return value.amount / value.divisor;
  return null;
}

function primaryImage(listing: EtsyListing) {
  const image = listing.Images?.[0] || listing.images?.[0];
  return image?.url_fullxfull || image?.url_570xN || image?.url_300x300 || image?.url_170x135 || null;
}

function listingImages(listing: EtsyListing) {
  const images = listing.Images || listing.images || [];
  return Array.from(new Set(images.map((image) => image.url_fullxfull || image.url_570xN || image.url_300x300 || image.url_170x135).filter(Boolean) as string[]));
}

function digitalSignals(listing: EtsyListing) {
  const text = [listing.title, listing.description, ...(listing.tags || [])].join(" ").toLowerCase();
  return ["digital download", "printable", "pdf", "png", "canva", "template", "stl", "3d print file"].some((signal) => text.includes(signal));
}

function inferCategory(listing: EtsyListing) {
  const text = [listing.title, listing.description, ...(listing.tags || []), ...(listing.taxonomy_path || [])].join(" ").toLowerCase();
  if (text.includes("desk") || text.includes("organizer") || text.includes("pencil")) return "Desk Accessories";
  if (text.includes("decor") || text.includes("poster") || text.includes("wall")) return "Decor";
  if (text.includes("custom") || text.includes("personalized")) return "Custom Orders";
  if (text.includes("gift")) return "Collectibles";
  return "Functional Prints";
}

function textIncludesPersonalization(listing: EtsyListing) {
  const text = [listing.title, listing.description, ...(listing.tags || [])].join(" ").toLowerCase();
  return ["custom", "personalized", "personalised", "name", "initial", "color choice", "colour choice"].some((signal) => text.includes(signal));
}

function inferColorOptions(listing: EtsyListing) {
  const text = [listing.title, listing.description, ...(listing.tags || [])].join(" ").toLowerCase();
  const colors = ["Black", "White", "Gray", "Red", "Blue", "Green", "Gold", "Silver", "Marble"];
  const found = colors.filter((color) => text.includes(color.toLowerCase()));
  return found.length ? found : ["Black", "White", "Custom color by request"];
}

function inferFinishOptions(listing: EtsyListing) {
  const text = [listing.title, listing.description, ...(listing.tags || [])].join(" ").toLowerCase();
  const finishes = ["Matte", "Silk", "Gloss", "Marble"];
  return finishes.filter((finish) => text.includes(finish.toLowerCase()));
}
