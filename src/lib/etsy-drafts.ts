import type { Product } from "@/lib/types";
import type { EtsyRuntimeSettings } from "@/lib/etsy-auth";

export type EtsyDraftInput = {
  apiKey: string;
  accessToken: string;
  shopId: string;
  taxonomyId: string;
  shippingProfileId?: string;
  readinessStateId?: string;
  returnPolicyId?: string;
  product: Product;
};

export type EtsyDraftResult = {
  listingId: number;
  url: string;
};

export function productToEtsyDraft(product: Product, taxonomyId: string) {
  const isDigital = isDigitalProduct(product);
  const body = new URLSearchParams();

  body.set("quantity", isDigital ? "999" : "10");
  body.set("title", etsyTitle(product));
  body.set("description", etsyDescription(product));
  body.set("price", String(product.price || 9.99));
  body.set("who_made", "i_did");
  body.set("when_made", "made_to_order");
  body.set("taxonomy_id", taxonomyId);
  body.set("is_supply", "false");

  if (isDigital) {
    body.set("type", "download");
  } else {
    const packageDetails = etsyPackageDetails(product);
    body.set("item_weight", packageDetails.weight);
    body.set("item_length", packageDetails.length);
    body.set("item_width", packageDetails.width);
    body.set("item_height", packageDetails.height);
    body.set("item_weight_unit", "oz");
    body.set("item_dimensions_unit", "in");
  }

  const tags = etsyTags(product);
  if (tags.length) body.set("tags", tags.join(","));

  return {
    body,
    isDigital,
  };
}

export async function createEtsyDraftFromProduct({
  apiKey,
  accessToken,
  shopId,
  taxonomyId,
  shippingProfileId,
  readinessStateId,
  returnPolicyId,
  product,
}: EtsyDraftInput): Promise<EtsyDraftResult> {
  const { body, isDigital } = productToEtsyDraft(product, taxonomyId);

  if (!isDigital) {
    if (!shippingProfileId) {
      throw new Error("ETSY_SHIPPING_PROFILE_ID is required to create physical Etsy draft listings.");
    }
    if (!readinessStateId) {
      throw new Error("ETSY_READINESS_STATE_ID is required to create physical Etsy draft listings.");
    }
    if (!returnPolicyId) {
      throw new Error("ETSY_RETURN_POLICY_ID is required to create physical Etsy draft listings.");
    }
    body.set("shipping_profile_id", shippingProfileId);
    body.set("readiness_state_id", readinessStateId);
    body.set("return_policy_id", returnPolicyId);
  }

  const response = await fetch(`https://api.etsy.com/v3/application/shops/${shopId}/listings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "x-api-key": apiKey,
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(etsyDraftErrorMessage(response.status, text));
  }

  const payload = JSON.parse(text) as { listing_id?: number; url?: string };
  if (!payload.listing_id) {
    throw new Error("Etsy created a response without a listing_id.");
  }

  return {
    listingId: payload.listing_id,
    url: payload.url || `https://www.etsy.com/listing/${payload.listing_id}`,
  };
}

export function etsyDraftRequirements(
  product: Product,
  { hasOAuthToken = false, settings }: { hasOAuthToken?: boolean; settings?: Partial<EtsyRuntimeSettings> } = {},
) {
  const isDigital = isDigitalProduct(product);
  const missing = ["ETSY_API_KEY"].filter((key) => !process.env[key]);

  if (!process.env.ETSY_SHOP_ID && !settings?.shopId) missing.push("ETSY_SHOP_ID");
  if (!process.env.ETSY_DEFAULT_TAXONOMY_ID && !settings?.taxonomyId) missing.push("ETSY_DEFAULT_TAXONOMY_ID");

  if (!process.env.ETSY_ACCESS_TOKEN && !hasOAuthToken) missing.push("ETSY_ACCESS_TOKEN or connected Etsy OAuth");

  if (!isDigital && !process.env.ETSY_SHIPPING_PROFILE_ID && !settings?.shippingProfileId) missing.push("ETSY_SHIPPING_PROFILE_ID");
  if (!isDigital && !process.env.ETSY_READINESS_STATE_ID && !settings?.readinessStateId) missing.push("ETSY_READINESS_STATE_ID");
  if (!isDigital && !process.env.ETSY_RETURN_POLICY_ID && !settings?.returnPolicyId) missing.push("ETSY_RETURN_POLICY_ID");

  return missing;
}

function etsyDraftErrorMessage(status: number, body: string) {
  const details = body.slice(0, 300);
  const normalized = body.toLowerCase();

  if (status === 401 || status === 403 || normalized.includes("access token") || normalized.includes("scope")) {
    return `Etsy draft creation needs an approved app and OAuth token with listings_w scope. Etsy returned ${status}: ${details}`;
  }

  return `Etsy draft creation failed with ${status}: ${details}`;
}

function isDigitalProduct(product: Product) {
  const text = [product.category, product.name, product.short_description, ...(product.tags || [])].join(" ").toLowerCase();
  return ["digital", "download", "printable", "pdf", "png", "poster"].some((signal) => text.includes(signal));
}

function etsyTitle(product: Product) {
  const suffix = isDigitalProduct(product) ? "Printable Digital Download" : physicalTitleSuffix(product);
  return `${buyerSafeTitle(product.name)} - ${suffix}, PRINTZ By Khan`.slice(0, 140);
}

function physicalTitleSuffix(product: Product) {
  const text = [product.name, product.category, product.short_description, ...(product.tags || [])].join(" ").toLowerCase();
  if (text.includes("aquarium")) return "3D Printed Aquarium Plant Holder";
  if (text.includes("plant") || text.includes("planter")) return "3D Printed Plant Organizer";
  if (text.includes("paint") || text.includes("brush") || text.includes("marker")) return "3D Printed Art Supply Organizer";
  if (text.includes("earring") || text.includes("jewelry")) return "3D Printed Jewelry Display";
  if (text.includes("battery")) return "3D Printed Battery Storage Organizer";
  if (text.includes("usb") || text.includes("sd card") || text.includes("cable") || text.includes("wire")) return "3D Printed Tech Organizer";
  if (text.includes("tea") || text.includes("mason") || text.includes("soap")) return "3D Printed Home Organizer";
  if (text.includes("pegboard") || text.includes("bit") || text.includes("workshop")) return "3D Printed Workshop Organizer";
  if (text.includes("file") || text.includes("stamp") || text.includes("desk") || text.includes("printer")) return "3D Printed Desk Organizer";
  return "3D Printed Organizer";
}

function etsyDescription(product: Product) {
  const customization = [
    product.customization_notes,
    product.personalization_enabled ? product.personalization_prompt : null,
    listLine("Color options", product.color_options),
    listLine("Size options", product.size_options),
    listLine("Finish options", product.finish_options),
  ]
    .filter(Boolean)
    .join("\n");

  const description = cleanBuyerText(product.full_description || product.short_description);
  const sourceSection = sourceAttributionSection(product);

  return `${product.name}

${description}

Details:
- Category: ${product.category}
- Materials: ${product.materials || "See listing details"}
- Dimensions: ${product.dimensions || "See listing photos/details"}
- Processing time: ${product.processing_time || "See Etsy checkout estimate"}

${customization ? `Customization:\n${customization}\n\n` : ""}Care:
${product.care_instructions || "Handle with care. Colors may vary slightly by screen, printer, paper, or filament batch."}

Notes:
- Created by PRINTZ By Khan.
- Review photos, options, and downloadable files before publishing.
- For physical 3D printed items, minor layer lines are normal.
${sourceSection ? `\nSource and license:\n${sourceSection}` : ""}`.slice(0, 13000);
}

function etsyTags(product: Product) {
  const internalTags = new Set(["first-publish-batch", "first-publish-batch-2026-06-30", "etsy-ads-test"]);
  const base = [
    ...(product.tags || []).filter((tag) => !internalTags.has(tag)),
    product.category,
    isDigitalProduct(product) ? "digital download" : "3d printed",
    "printz by khan",
  ];

  return Array.from(new Set(base.map((tag) => tag.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim())))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 20))
    .slice(0, 13);
}

function etsyPackageDetails(product: Product) {
  const text = [product.name, product.category, product.short_description, product.dimensions, ...(product.tags || [])]
    .join(" ")
    .toLowerCase();

  if (text.includes("cookie") || text.includes("cutter")) {
    return { weight: "4", length: "6", width: "6", height: "2" };
  }
  if (text.includes("lamp")) {
    return { weight: "12", length: "8", width: "8", height: "8" };
  }
  if (text.includes("shelf") || text.includes("wall")) {
    return { weight: "16", length: "10", width: "8", height: "4" };
  }
  if (text.includes("controller") || text.includes("stand")) {
    return { weight: "8", length: "8", width: "6", height: "4" };
  }
  if (text.includes("vase") || text.includes("planter")) {
    return { weight: "10", length: "8", width: "8", height: "8" };
  }

  return { weight: "8", length: "8", width: "6", height: "4" };
}

function listLine(label: string, values?: string[] | null) {
  return values?.length ? `${label}: ${values.join(", ")}` : null;
}

function buyerSafeTitle(value: string) {
  return value
    .replace(/\bNintendo\s+Switch\s+Console\b/gi, "Game Console")
    .replace(/\bNintendo\s+Switch\b/gi, "Game Console")
    .replace(/\bXbox\s+One\s*\/\s*Series\s*X\|S\s+Controller\b/gi, "Game Controller")
    .replace(/\bXbox\s+One\s*\/\s*Series\s*X\|S\b/gi, "Game Controller")
    .replace(/\bXbox\b/gi, "Game Controller")
    .replace(/\bGame Controller\s+Controller\b/gi, "Game Controller")
    .replace(/\bGame Console\s+Console\b/gi, "Game Console")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function sourceAttributionSection(product: Product) {
  const lines: string[] = [];
  const sourcePlatform = product.source_platform || (product.source_url?.includes("makerworld.com") ? "MakerWorld" : "");
  const creator = product.creator_name?.trim();
  const license = product.license_type?.trim();
  const modelTitle = sourceModelTitle(product);

  if (license || product.source_url || creator || sourcePlatform) {
    lines.push(`Model: ${modelTitle || product.name}`);
    if (creator) lines.push(`Creator: ${creator}`);
    if (sourcePlatform) lines.push(`Platform: ${sourcePlatform}`);
    if (product.source_url) lines.push(`Source: ${product.source_url}`);
    if (license) lines.push(`License: ${license}${product.license_url ? ` - ${product.license_url}` : ""}`);
    lines.push(`Changes / use: ${attributionChangeStatement(product)}`);
  } else if (product.attribution_text?.trim()) {
    lines.push(`Attribution: ${product.attribution_text.trim()}`);
  }

  if (product.attribution_required === true) {
    lines.push("Attribution notice: This listing provides creator, source, license, and use/change details for the source model.");
  } else if (product.attribution_required === false && license) {
    lines.push("Attribution notice: Attribution is optional under this license, but source details are included for transparency.");
  }

  if (product.share_alike_required) {
    lines.push("Share-alike terms apply to adaptations where required by the source license.");
  }

  if (!lines.length && product.license_notes) {
    lines.push(cleanBuyerText(product.license_notes));
  }

  return lines.join("\n");
}

function sourceModelTitle(product: Product) {
  const attribution = product.attribution_text?.trim();
  const titleFromAttribution = attribution?.split(/\s+by\s+/i)[0]?.replace(/^["“”]+|["“”]+$/g, "").trim();
  return titleFromAttribution || "";
}

function attributionChangeStatement(product: Product) {
  const license = product.license_type?.toLowerCase() || "";
  if (license.includes("cc0")) {
    return "Physical 3D printed item made by PRINTZ By Khan from the source model. Attribution is not required under CC0.";
  }
  if (product.modification_allowed === false || license.includes("by-nd")) {
    return "Physical 3D printed item made by PRINTZ By Khan from the unmodified source model; color, material, scale, and print settings may vary. No modified model files are redistributed.";
  }
  if (product.share_alike_required || license.includes("by-sa")) {
    return "Physical 3D printed item made by PRINTZ By Khan. Color, material, scale, and print-setting adjustments may be used; adaptations remain subject to the share-alike license terms where applicable. No digital model files are redistributed.";
  }
  return "Physical 3D printed item made by PRINTZ By Khan. Color, material, scale, and print-setting adjustments may be used. No digital model files are redistributed.";
}

function cleanBuyerText(value: string | null | undefined) {
  return String(value || "")
    .replace(/Source model notes:[\s\S]*?(?=\n\nMaterials:|\n\nWhat to expect:|\n\nOptions:|\n\nMakerWorld source verified|$)/gi, "")
    .replace(/Admin production note:[^\n]*(\n\n)?/gi, "")
    .replace(/Source model\/listing is attached[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/<[^>]*>/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
