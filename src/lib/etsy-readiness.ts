import type { Product } from "@/lib/types";

export type EtsyReadinessLevel = "required" | "recommended";

export type EtsyReadinessItem = {
  key: string;
  label: string;
  detail: string;
  ok: boolean;
  level: EtsyReadinessLevel;
};

export type EtsyReadinessSummary = {
  productType: "Digital" | "Physical";
  readyToDraft: boolean;
  readyToPublish: boolean;
  requiredMissing: number;
  recommendedMissing: number;
  items: EtsyReadinessItem[];
};

export function getEtsyReadiness(product: Product, options: { imageCount?: number } = {}): EtsyReadinessSummary {
  const productType = isDigitalProduct(product) ? "Digital" : "Physical";
  const imageCount = options.imageCount ?? (product.main_image_url ? 1 : 0);
  const tags = publicEtsyTags(product.tags || []);
  const hasRightsNotes = Boolean(product.license_notes?.trim() || product.rights_status?.trim() || product.source_url?.trim());
  const hasVariants = Boolean(product.color_options?.length || product.size_options?.length || product.finish_options?.length);

  const items: EtsyReadinessItem[] = [
    {
      key: "title",
      label: "Etsy-safe title",
      detail: product.name.length <= 105 ? "Product name leaves room for Etsy suffix text." : "Shorten product name so the generated Etsy title stays under 140 characters.",
      ok: Boolean(product.name.trim()) && product.name.length <= 105,
      level: "required",
    },
    {
      key: "price",
      label: "Price set",
      detail: product.price && product.price > 0 ? `Ready at $${product.price.toFixed(2)}.` : "Add a non-zero price before creating or publishing an Etsy listing.",
      ok: Boolean(product.price && product.price > 0),
      level: "required",
    },
    {
      key: "description",
      label: "Buyer-ready description",
      detail: (product.full_description || product.short_description || "").length >= 80
        ? "Description has enough detail for Etsy buyers."
        : "Add use case, what is included, sizing, and buyer expectations.",
      ok: (product.full_description || product.short_description || "").length >= 80,
      level: "required",
    },
    {
      key: "image",
      label: "Listing images",
      detail: imageCount >= 5 ? `${imageCount} images available.` : "Aim for at least 5 original product images before publishing.",
      ok: imageCount >= 1,
      level: "required",
    },
    {
      key: "tags",
      label: "Etsy tags",
      detail: tags.length >= 8 && tags.length <= 13
        ? `${tags.length} tags set.`
        : "Use 8-13 Etsy search phrases; each generated Etsy tag is trimmed to 20 characters.",
      ok: tags.length >= 8 && tags.length <= 13,
      level: "recommended",
    },
    {
      key: "rights",
      label: "Rights checked",
      detail: hasRightsNotes ? "Source/license notes are present." : "Add original-design notes or commercial license/source notes before publishing.",
      ok: hasRightsNotes,
      level: "required",
    },
    {
      key: "materials",
      label: productType === "Digital" ? "Files included" : "Materials listed",
      detail: product.materials?.trim()
        ? "Materials/files field is filled."
        : productType === "Digital"
          ? "List PDF, PNG, STL, Canva, or other included file formats."
          : "List filament/material and any included hardware.",
      ok: Boolean(product.materials?.trim()),
      level: "required",
    },
    {
      key: "dimensions",
      label: productType === "Digital" ? "File sizes / formats" : "Dimensions listed",
      detail: product.dimensions?.trim()
        ? "Dimensions/formats field is filled."
        : productType === "Digital"
          ? "Add page size, file dimensions, or format details."
          : "Add product dimensions or size range.",
      ok: Boolean(product.dimensions?.trim()),
      level: "required",
    },
    {
      key: "processing",
      label: productType === "Digital" ? "Delivery notes" : "Processing time",
      detail: product.processing_time?.trim()
        ? "Processing/delivery timing is filled."
        : productType === "Digital"
          ? "Clarify instant download or file delivery timing."
          : "Add made-to-order processing time.",
      ok: Boolean(product.processing_time?.trim()),
      level: "required",
    },
    {
      key: "care",
      label: "Care / usage notes",
      detail: product.care_instructions?.trim() ? "Care or usage notes are filled." : "Add handling, heat, cleaning, or digital-use notes.",
      ok: Boolean(product.care_instructions?.trim()),
      level: "recommended",
    },
    {
      key: "variants",
      label: "Options / variants",
      detail: hasVariants ? "At least one option set is present." : "Add color, size, finish, or file/variant choices where relevant.",
      ok: hasVariants,
      level: "recommended",
    },
    {
      key: "personalization",
      label: "Personalization prompt",
      detail: !product.personalization_enabled || product.personalization_prompt?.trim()
        ? "Personalization settings are clear."
        : "Add the exact prompt buyers should answer for personalized products.",
      ok: !product.personalization_enabled || Boolean(product.personalization_prompt?.trim()),
      level: "required",
    },
  ];

  const requiredMissing = items.filter((item) => item.level === "required" && !item.ok).length;
  const recommendedMissing = items.filter((item) => item.level === "recommended" && !item.ok).length;

  return {
    productType,
    readyToDraft: requiredMissing === 0,
    readyToPublish: requiredMissing === 0 && recommendedMissing === 0 && imageCount >= 5,
    requiredMissing,
    recommendedMissing,
    items,
  };
}

function publicEtsyTags(tags: string[]) {
  const internalTags = new Set(["first-publish-batch", "first-publish-batch-2026-06-30", "etsy-ads-test"]);
  return tags.filter((tag) => !internalTags.has(tag));
}

export function etsyReadinessLabel(summary: EtsyReadinessSummary) {
  if (summary.readyToPublish) return "Ready to publish";
  if (summary.readyToDraft) return "Draft ready";
  return `${summary.requiredMissing} required missing`;
}

function isDigitalProduct(product: Product) {
  const text = [product.category, product.name, product.short_description, ...(product.tags || [])].join(" ").toLowerCase();
  return ["digital", "download", "printable", "pdf", "png", "poster", "stl"].some((signal) => text.includes(signal));
}
