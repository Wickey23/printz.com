import type { Product } from "@/lib/types";

export function isRequestOnlyProduct(product: Product) {
  return Boolean(product.source_url && !product.etsy_url);
}

export function requestPrintHref(product: Product) {
  const params = new URLSearchParams({
    title: product.name,
    model_source_platform: sourcePlatform(product.source_url),
    notes: requestNotes(product),
  });

  if (product.source_url) params.set("model_source_url", product.source_url);

  return `/custom-print?${params.toString()}`;
}

function requestNotes(product: Product) {
  return [
    product.short_description,
    product.customization_notes ? `Customization: ${product.customization_notes}` : "",
    product.license_notes ? `License note: ${product.license_notes}` : "",
  ].filter(Boolean).join("\n\n");
}

function sourcePlatform(sourceUrl?: string | null) {
  const value = sourceUrl || "";
  if (value.includes("makerworld.com")) return "MakerWorld";
  if (value.includes("printables.com")) return "Printables";
  if (value.includes("thingiverse.com")) return "Thingiverse";
  if (value.includes("thangs.com")) return "Thangs";
  if (value.includes("cults3d.com")) return "Cults";
  return "Source model";
}
