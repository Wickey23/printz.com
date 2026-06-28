import { getEtsyReadiness } from "@/lib/etsy-readiness";
import { isRequestOnlyProduct } from "@/lib/product-flags";
import type { Product, ProductMedia, ProductSyncHealth } from "@/lib/types";

export type LaunchAuditSeverity = "blocker" | "warning" | "ready";

export type LaunchAuditItem = {
  key: string;
  label: string;
  detail: string;
  severity: LaunchAuditSeverity;
  href?: string;
};

export type LaunchAuditSummary = {
  activeProducts: number;
  purchasableProducts: number;
  requestOnlyProducts: number;
  draftReadyProducts: number;
  publishReadyProducts: number;
  blockers: number;
  warnings: number;
  ready: number;
  items: LaunchAuditItem[];
};

export function getLaunchAudit({
  mediaByProductId,
  products,
  syncHealth,
}: {
  mediaByProductId: Record<string, ProductMedia[]>;
  products: Product[];
  syncHealth: ProductSyncHealth;
}): LaunchAuditSummary {
  const activeProducts = products.filter((product) => product.active);
  const purchasableProducts = activeProducts.filter((product) => Boolean(product.etsy_url));
  const requestOnlyProducts = activeProducts.filter(isRequestOnlyProduct);
  const readiness = activeProducts.map((product) =>
    getEtsyReadiness(product, {
      imageCount: productImageCount(product, mediaByProductId[product.id] || []),
    }),
  );

  const items: LaunchAuditItem[] = [
    productCountItem(activeProducts.length),
    purchasableCountItem(purchasableProducts.length, requestOnlyProducts.length),
    readinessItem(
      readiness.filter((item) => item.readyToDraft).length,
      readiness.filter((item) => item.readyToPublish).length,
      activeProducts.length,
    ),
    originalMediaItem(activeProducts, mediaByProductId),
    rightsItem(activeProducts),
    operationsItem(syncHealth),
    etsyConnectionItem(),
  ];

  return {
    activeProducts: activeProducts.length,
    purchasableProducts: purchasableProducts.length,
    requestOnlyProducts: requestOnlyProducts.length,
    draftReadyProducts: readiness.filter((item) => item.readyToDraft).length,
    publishReadyProducts: readiness.filter((item) => item.readyToPublish).length,
    blockers: items.filter((item) => item.severity === "blocker").length,
    warnings: items.filter((item) => item.severity === "warning").length,
    ready: items.filter((item) => item.severity === "ready").length,
    items,
  };
}

function productImageCount(product: Product, media: ProductMedia[]) {
  const urls = new Set([product.main_image_url, ...media.map((item) => item.url)].filter(Boolean));
  return urls.size;
}

function productCountItem(activeProductCount: number): LaunchAuditItem {
  if (activeProductCount >= 5) {
    return {
      key: "active-products",
      label: "Launch catalog",
      detail: `${activeProductCount} active products are visible on the site.`,
      severity: "ready",
      href: "/admin",
    };
  }

  return {
    key: "active-products",
    label: "Launch catalog",
    detail: `${activeProductCount} active products are visible. Aim for at least 5 tight launch products before sending traffic.`,
    severity: activeProductCount ? "warning" : "blocker",
    href: "/admin/products/new",
  };
}

function purchasableCountItem(purchasableCount: number, requestOnlyCount: number): LaunchAuditItem {
  if (purchasableCount >= 3) {
    return {
      key: "purchasable-products",
      label: "Etsy checkout paths",
      detail: `${purchasableCount} products link to Etsy, with ${requestOnlyCount} request-only products available for quote flow.`,
      severity: "ready",
      href: "/products",
    };
  }

  return {
    key: "purchasable-products",
    label: "Etsy checkout paths",
    detail: `${purchasableCount} active products link to Etsy. Publish or connect at least 3 listings before launch.`,
    severity: "blocker",
    href: "/admin/etsy",
  };
}

function readinessItem(draftReadyCount: number, publishReadyCount: number, activeProductCount: number): LaunchAuditItem {
  if (publishReadyCount >= 3) {
    return {
      key: "etsy-readiness",
      label: "Listing readiness",
      detail: `${publishReadyCount} products meet publish-ready checks, and ${draftReadyCount} are draft-ready.`,
      severity: "ready",
      href: "/admin",
    };
  }

  return {
    key: "etsy-readiness",
    label: "Listing readiness",
    detail: `${draftReadyCount}/${activeProductCount} active products are Etsy draft-ready and ${publishReadyCount} are publish-ready. Open product edits and clear required readiness gaps.`,
    severity: draftReadyCount ? "warning" : "blocker",
    href: "/admin",
  };
}

function originalMediaItem(products: Product[], mediaByProductId: Record<string, ProductMedia[]>): LaunchAuditItem {
  const productsWithFiveImages = products.filter((product) => productImageCount(product, mediaByProductId[product.id] || []) >= 5).length;

  if (productsWithFiveImages >= 3) {
    return {
      key: "product-media",
      label: "Product photos",
      detail: `${productsWithFiveImages} products have 5 or more media assets.`,
      severity: "ready",
      href: "/admin/imports",
    };
  }

  return {
    key: "product-media",
    label: "Product photos",
    detail: `${productsWithFiveImages} products have 5 or more media assets. Shoot original photos for the first 3 launch listings and import them from Drive or product admin.`,
    severity: "warning",
    href: "/admin/imports",
  };
}

function rightsItem(products: Product[]): LaunchAuditItem {
  const missingRights = products.filter((product) => !product.license_notes?.trim() && !product.rights_status?.trim()).length;

  if (!missingRights) {
    return {
      key: "rights",
      label: "Rights review",
      detail: "Every active product has license or rights notes.",
      severity: "ready",
      href: "/admin",
    };
  }

  return {
    key: "rights",
    label: "Rights review",
    detail: `${missingRights} active products need original-design notes, source license notes, or commercial-use confirmation before selling.`,
    severity: "blocker",
    href: "/admin",
  };
}

function operationsItem(syncHealth: ProductSyncHealth): LaunchAuditItem {
  const missing = [
    syncHealth.configured.supabase ? "" : "Supabase",
    syncHealth.configured.google ? "" : "Google service account",
    syncHealth.configured.secret ? "" : "sync secret",
    syncHealth.configured.sheetId ? "" : "sheet ID",
    syncHealth.migrationReady ? "" : "sync migration tables",
  ].filter(Boolean);

  if (!missing.length) {
    return {
      key: "ops-sync",
      label: "Product operations",
      detail: "Supabase, Google Sheet sync, secrets, and migration tables are configured.",
      severity: "ready",
      href: "/admin/imports",
    };
  }

  return {
    key: "ops-sync",
    label: "Product operations",
    detail: `Set up ${missing.join(", ")} so product edits, media imports, and command-center sync are reliable.`,
    severity: "warning",
    href: "/admin/imports",
  };
}

function etsyConnectionItem(): LaunchAuditItem {
  const missing = [
    process.env.ETSY_API_KEY ? "" : "API key",
    process.env.ETSY_SHOP_ID ? "" : "shop ID",
    process.env.ETSY_DEFAULT_TAXONOMY_ID ? "" : "taxonomy ID",
    process.env.ETSY_SHIPPING_PROFILE_ID ? "" : "shipping profile",
  ].filter(Boolean);

  if (!missing.length) {
    return {
      key: "etsy-api",
      label: "Etsy API setup",
      detail: "Core Etsy API settings are present for sync and draft creation.",
      severity: "ready",
      href: "/admin/etsy",
    };
  }

  return {
    key: "etsy-api",
    label: "Etsy API setup",
    detail: `Missing ${missing.join(", ")}. Connect Etsy and save runtime settings before relying on automated drafts.`,
    severity: "warning",
    href: "/admin/etsy",
  };
}
