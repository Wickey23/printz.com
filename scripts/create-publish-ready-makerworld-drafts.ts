import { createSupabaseAdminClient } from "../src/lib/supabase/server";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken } from "../src/lib/etsy-auth";
import { createOrSyncEtsyListing } from "../src/lib/etsy-listings";
import type { Product, ProductMedia } from "../src/lib/types";

type Hit = {
  id?: number;
  title?: string;
  slug?: string;
  likeCount?: number;
  collectionCount?: number;
  printCount?: number;
  downloadCount?: number;
};

type Design = {
  title?: string;
  slug?: string;
  coverUrl?: string;
  coverPortrait?: string;
  summary?: string;
  license?: string;
  tags?: string[];
  designCreator?: { name?: string; handle?: string };
  designExtension?: { design_pictures?: Array<{ url?: string }> };
  instances?: Array<{
    cover?: string;
    prediction?: number;
    pictures?: Array<{ url?: string }>;
    instanceFilaments?: Array<{ type?: string; usedG?: string }>;
    extention?: {
      modelInfo?: {
        plates?: Array<{ thumbnail?: { url?: string }; pick_picture?: { url?: string } }>;
      };
    };
  }>;
};

type LicenseInfo = {
  label: string;
  url: string;
  attribution: boolean;
  modification: boolean;
  shareAlike: boolean;
};

const target = Number(process.argv[2] || process.env.PRINTZ_BATCH_TARGET || 20);
const minImages = Number(process.env.PRINTZ_MIN_ETSY_IMAGES || 5);
const riskPattern =
  /\b(oral\s*-?b|milwaukee|ryobi|citadel|games\s*workshop|dewalt|makita|bosch|craftsman|stanley|nintendo|switch|xbox|playstation|ps5|ps4|mario|pokemon|disney|marvel|star\s*wars|lego|ikea|tesla|apple|iphone|ipad|airpods|dyson|nike|adidas|yeti|hydro\s*flask|gridfinity|barbie|hello\s*kitty|snoopy|minecraft|fortnite|roblox|weapon|gun|knife)\b/i;
const nonAsciiPattern = /[^\x00-\x7F]/;

const queries = [
  "coaster holder geometric",
  "napkin holder modern",
  "soap saver bathroom",
  "dish brush holder sink",
  "plant saucer tray",
  "ring holder cone",
  "earring organizer stand",
  "paint brush holder organizer",
  "seed packet organizer",
  "book page holder reader",
  "wall hook decorative",
  "utensil holder kitchen",
  "coffee filter stand",
  "tea bag box organizer",
  "key holder wall modern",
  "mail sorter entryway",
  "sponge holder sink",
  "toothpaste squeezer bathroom",
  "sd card organizer",
  "memory card case holder",
  "desk tray organizer",
  "cable clip desk",
  "cord organizer clip",
  "drawer organizer tray",
  "bathroom shelf organizer",
  "makeup brush holder",
  "plant propagation station",
  "test tube plant holder",
  "wall planter modern",
  "succulent planter pot",
  "paint bottle organizer",
  "craft supply tray",
  "sewing spool holder",
  "bobbin holder sewing",
  "jar lid holder",
  "bag clip kitchen",
  "label holder bin",
  "screw tray organizer",
  "pegboard cup",
  "clamp rack wall",
  "sandpaper holder",
  "bit holder organizer",
  "phone stand desk",
  "tablet stand desk",
  "watch stand desk",
  "headphone hook desk",
  "remote caddy holder",
  "photo frame stand",
  "fridge magnet frame",
];

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role key is required.");

  const token = await getValidEtsyOAuthToken();
  const accessToken = token?.access_token || process.env.ETSY_ACCESS_TOKEN || "";
  const apiKey = process.env.ETSY_API_KEY || "";
  const settings = await getEffectiveEtsyRuntimeSettings();
  if (!accessToken || !apiKey || !settings.shopId || !settings.taxonomyId) {
    throw new Error("Etsy credentials/settings are incomplete.");
  }

  const { data: existingProducts, error: existingError } = await supabase.from("products").select("source_url");
  if (existingError) throw existingError;
  const seenModelIds = new Set((existingProducts || []).map((product) => makerWorldModelId(String(product.source_url || ""))).filter(Boolean));
  const created: unknown[] = [];
  const skipped: unknown[] = [];

  for (const query of queries) {
    if (created.length >= target) break;
    const hits = await searchMakerWorld(query);
    for (const hit of hits) {
      if (created.length >= target) break;
      if (!hit.id || seenModelIds.has(String(hit.id))) continue;
      seenModelIds.add(String(hit.id));
      if (hasRisk([query, hit.title, hit.slug].join(" "))) continue;

      const design = await getMakerWorldDesign(hit.id).catch((error) => {
        skipped.push({ query, title: hit.title, reason: error instanceof Error ? error.message : String(error) });
        return null;
      });
      if (!design) continue;

      const source = sourceFromDesign(design, hit);
      if (!source.ok) {
        skipped.push({ query, title: hit.title, reason: source.reason });
        continue;
      }

      try {
        const result = await createPublishReadyDraft({ supabase, apiKey, accessToken, settings, query, source: source.value });
        if (result.ok) created.push(result);
        else skipped.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        skipped.push({ query, title: source.value.title, reason: error instanceof Error ? error.message : String(error) });
      }

      await delay(350);
    }
  }

  console.log(JSON.stringify({ created: created.length, target, skipped: skipped.slice(0, 30) }, null, 2));
}

async function createPublishReadyDraft({
  supabase,
  apiKey,
  accessToken,
  settings,
  query,
  source,
}: {
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  apiKey: string;
  accessToken: string;
  settings: Awaited<ReturnType<typeof getEffectiveEtsyRuntimeSettings>>;
  query: string;
  source: Source;
}) {
  const category = categoryFor(query);
  const name = buyerTitle(source.title, query);
  const slug = await uniqueSlug(supabase, slugify(name));
  const notes = licenseNotes(source);
  const payload = {
    name,
    slug,
    short_description: `Made-to-order ${category.toLowerCase()} selected for practical everyday use and gifting.`,
    full_description: [
      `${name} is a made-to-order 3D printed ${category.toLowerCase()} selected for clean utility, strong photos, and a commercial-safe source license.`,
      "Review final color, sizing, and print settings before publishing.",
      `Source model notes: ${source.summary || source.title}`,
    ].join("\n\n").slice(0, 4500),
    category,
    price: priceFor(query),
    etsy_url: null,
    main_image_url: source.images[0],
    video_url: null,
    materials: `${source.material || "PLA or PETG"} 3D printed plastic`,
    dimensions: "Final dimensions depend on selected size/profile. Confirm exact size before publishing or printing.",
    customization_notes: "Choose available color, size, and finish options before production.",
    personalization_enabled: false,
    personalization_prompt: null,
    color_options: ["Black", "White", "Red", "Blue", "Green", "Custom color"],
    size_options: ["Standard", "Custom size"],
    finish_options: ["Standard"],
    processing_time: "Made to order in 2-4 business days",
    care_instructions: "Keep away from high heat. Clean gently with a dry or slightly damp cloth. Layer lines and small surface variations are normal for 3D printed items.",
    source_url: source.sourceUrl,
    license_notes: notes,
    tags: tagsFor(source, category),
    featured: false,
    active: false,
    workflow_status: "Draft Ready",
    rights_status: "Ready",
    media_status: "Ready",
    pricing_status: "Ready",
    trademark_review_status: "Ready",
    source_platform: "MakerWorld",
    creator_name: source.creator,
    license_type: source.license.label,
    license_url: source.license.url,
    commercial_sale_allowed: true,
    modification_allowed: source.license.modification,
    attribution_required: source.license.attribution,
    share_alike_required: source.license.shareAlike,
    attribution_text: source.license.attribution ? `${source.title} by ${source.creator} on MakerWorld` : null,
    rights_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error } = await supabase.from("products").insert(payload).select("*").single();
  if (error) throw error;
  const product = inserted as Product;

  const { error: mediaError } = await supabase.from("product_media").insert(
    source.images.slice(0, 10).map((url, sort_order) => ({
      product_id: product.id,
      media_type: "image",
      url,
      sort_order,
    })),
  );
  if (mediaError) throw mediaError;

  const media = await productMedia(supabase, product.id);
  const sync = await createOrSyncEtsyListing({ apiKey, accessToken, settings, product, media, publish: false });
  const audit = await auditEtsyListing({ apiKey, accessToken, listingId: sync.listingId });
  const ok = audit.imageCount >= minImages && audit.descriptionOk;

  await supabase
    .from("products")
    .update({
      etsy_listing_id: sync.listingId,
      etsy_url: sync.url,
      etsy_state: "draft",
      active: ok,
      workflow_status: ok ? "Draft Ready" : "Needs Review",
      rights_status: ok ? "Ready" : "Needs Review",
      media_status: audit.imageCount >= minImages ? "Ready" : "Needs Review",
      license_notes: `${notes}\n\nPRINTZ Etsy audit ${new Date().toISOString()}: ${ok ? "Publish-ready draft verified" : "Needs review"}; Etsy images=${audit.imageCount}; description characters=${audit.descriptionLength}.`,
      updated_at: new Date().toISOString(),
    })
    .eq("id", product.id);

  return { ok, name, listingId: sync.listingId, imageCount: audit.imageCount, url: sync.url };
}

async function searchMakerWorld(query: string) {
  const url = new URL("https://api.bambulab.com/v1/search-service/select/design2");
  url.searchParams.set("keyword", query);
  url.searchParams.set("limit", "20");
  const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "PRINTZ automation" }, cache: "no-store" });
  if (!response.ok) return [];
  const payload = (await response.json()) as { hits?: Hit[] };
  return (payload.hits || []).sort((a, b) => candidateScore(b) - candidateScore(a));
}

async function getMakerWorldDesign(id: number) {
  const response = await fetch(`https://api.bambulab.com/v1/design-service/design/${id}`, {
    headers: { accept: "application/json", "user-agent": "PRINTZ automation" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`MakerWorld detail returned ${response.status}`);
  return (await response.json()) as Design;
}

type Source = {
  title: string;
  creator: string;
  sourceUrl: string;
  images: string[];
  tags: string[];
  summary: string;
  material: string;
  license: LicenseInfo;
};

function sourceFromDesign(design: Design, hit: Hit): { ok: true; value: Source } | { ok: false; reason: string } {
  const title = cleanText(design.title || "");
  const creator = cleanText(design.designCreator?.name || design.designCreator?.handle || "");
  const license = licenseInfo(String(design.license || ""));
  const images = imageUrls(design);
  const riskText = [title, design.slug, design.summary, ...(design.tags || [])].join(" ");

  if (!title || nonAsciiPattern.test(title)) return { ok: false, reason: "Non-English or empty title." };
  if (!creator) return { ok: false, reason: "Missing creator attribution." };
  if (!license) return { ok: false, reason: "License is not commercial-safe." };
  if (images.length < minImages) return { ok: false, reason: `Only ${images.length} source images.` };
  if (hasRisk(riskText)) return { ok: false, reason: "Protected term risk." };

  return {
    ok: true,
    value: {
      title,
      creator,
      sourceUrl: makerWorldSourceUrl(hit),
      images,
      tags: (design.tags || []).map(cleanText).filter(Boolean).slice(0, 10),
      summary: cleanText(design.summary || ""),
      material: design.instances?.[0]?.instanceFilaments?.[0]?.type || "PLA or PETG",
      license,
    },
  };
}

function imageUrls(design: Design) {
  return Array.from(
    new Set([
      design.coverUrl,
      design.coverPortrait,
      ...(design.designExtension?.design_pictures || []).map((item) => item.url),
      ...(design.instances || []).flatMap((instance) => [
        instance.cover,
        ...(instance.pictures || []).map((item) => item.url),
        ...(instance.extention?.modelInfo?.plates || []).flatMap((plate) => [plate.thumbnail?.url, plate.pick_picture?.url]),
      ]),
    ].filter((url): url is string => Boolean(url && /^https?:\/\//i.test(url)))),
  ).slice(0, 10);
}

function licenseInfo(license: string): LicenseInfo | null {
  const normalized = license.toLowerCase().replace(/\s+/g, "");
  if (normalized.includes("nc")) return null;
  if (normalized.includes("cc0") || normalized === "0") {
    return { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/", attribution: false, modification: true, shareAlike: false };
  }
  if (normalized.includes("by-sa") || normalized.includes("bysa")) {
    return { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/", attribution: true, modification: true, shareAlike: true };
  }
  if (normalized.includes("by-nd") || normalized.includes("bynd")) {
    return { label: "CC BY-ND 4.0", url: "https://creativecommons.org/licenses/by-nd/4.0/", attribution: true, modification: false, shareAlike: false };
  }
  if (normalized.includes("by")) {
    return { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/", attribution: true, modification: true, shareAlike: false };
  }
  return null;
}

async function auditEtsyListing({ apiKey, accessToken, listingId }: { apiKey: string; accessToken: string; listingId: number }) {
  const [imagesResponse, listingResponse] = await Promise.all([
    fetch(`https://api.etsy.com/v3/application/listings/${listingId}/images`, { headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey } }),
    fetch(`https://api.etsy.com/v3/application/listings/${listingId}`, { headers: { Authorization: `Bearer ${accessToken}`, "x-api-key": apiKey } }),
  ]);
  const images = imagesResponse.ok ? ((await imagesResponse.json()) as { count?: number; results?: unknown[] }) : {};
  const listing = listingResponse.ok ? ((await listingResponse.json()) as { description?: string }) : {};
  const description = String(listing.description || "");
  return {
    imageCount: images.count ?? images.results?.length ?? 0,
    descriptionLength: description.length,
    descriptionOk:
      description.length >= 250 &&
      /Model:\s/.test(description) &&
      /Creator:\s/.test(description) &&
      /Source:\shttps:\/\/makerworld\.com/.test(description) &&
      /License:\s/.test(description) &&
      /Changes \/ use:/.test(description),
  };
}

async function productMedia(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productId: string) {
  const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as ProductMedia[];
}

async function uniqueSlug(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, base: string) {
  let slug = base || `product-${Date.now()}`;
  for (let index = 2; index < 100; index++) {
    const { data, error } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    slug = `${base}-${index}`.slice(0, 95);
  }
  throw new Error("Could not create unique slug.");
}

function licenseNotes(source: Source) {
  return [
    "PRINTZ publish-ready sourcing note: MakerWorld source verified.",
    `Model: ${source.title}.`,
    `Creator: ${source.creator}.`,
    `Source: ${source.sourceUrl}.`,
    `License: ${source.license.label} (${source.license.url}).`,
    source.license.attribution ? "Attribution required." : "Attribution optional.",
    source.license.modification ? "Modifications allowed." : "No derivatives / sell unmodified only.",
    source.license.shareAlike ? "Share-alike applies to adaptations." : "",
    "Etsy draft includes attribution and image readback before activation.",
  ].filter(Boolean).join(" ");
}

function tagsFor(source: Source, category: string) {
  return Array.from(new Set([...source.tags, category, "3d printed", "made to order", "organization"].map((tag) => cleanText(tag).toLowerCase()).filter(Boolean))).slice(0, 13);
}

function buyerTitle(sourceTitle: string, query: string) {
  const cleaned = cleanText(sourceTitle)
    .replace(/\b(stl|3mf|makerworld|bambu|print profile|free|v\d+)\b/gi, "")
    .replace(/^[^A-Za-z0-9]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 8 && cleaned.length <= 90 && !hasRisk(cleaned)) return cleaned;
  return cleanText(query)
    .replace(/\b(generic|modern)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .slice(0, 90);
}

function categoryFor(query: string) {
  if (/soap|bath|tooth|razor|makeup/.test(query)) return "Bathroom";
  if (/plant|saucer|seed|propagation|planter/.test(query)) return "Planters";
  if (/coffee|tea|utensil|kitchen|sponge|dish|napkin|bag clip|jar/.test(query)) return "Kitchen";
  if (/ring|earring|jewelry/.test(query)) return "Jewelry";
  if (/cable|phone|tablet|watch|headphone|sd card|memory/.test(query)) return "Tech Accessories";
  if (/clamp|sandpaper|bit holder|screw|pegboard/.test(query)) return "Workshop";
  return "Desk Accessories";
}

function priceFor(query: string) {
  if (/hook|clip|squeezer|label/.test(query)) return 12.99;
  if (/holder|stand|organizer|saver|tray/.test(query)) return 19.99;
  return 24.99;
}

function makerWorldSourceUrl(hit: Hit) {
  return `https://makerworld.com/en/models/${hit.id}${hit.slug ? `-${hit.slug}` : ""}?from=search`;
}

function makerWorldModelId(url: string) {
  return url.match(/models\/(\d+)/)?.[1] || "";
}

function candidateScore(hit: Hit) {
  return Number(hit.printCount || 0) * 3 + Number(hit.downloadCount || 0) + Number(hit.collectionCount || 0) * 0.5 + Number(hit.likeCount || 0) * 0.25;
}

function hasRisk(value: string) {
  return riskPattern.test(value) || nonAsciiPattern.test(value);
}

function cleanText(value: string) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
