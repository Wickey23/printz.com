import type { Product } from "@/lib/types";

type SalesLikelihoodInput = Pick<Product, "name" | "category" | "price" | "tags" | "source_url" | "license_type" | "commercial_sale_allowed" | "media_status" | "rights_status"> & {
  query?: string;
  imageCount?: number;
};

const highIntentTerms = [
  "organizer",
  "holder",
  "stand",
  "rack",
  "tray",
  "clip",
  "hook",
  "caddy",
  "shelf",
  "divider",
  "label",
  "storage",
  "mount",
];

const printNativeTerms = [
  "parametric",
  "parametrized",
  "customizable",
  "adjustable",
  "modular",
  "stackable",
  "wall mounted",
  "wall-mounted",
  "under shelf",
  "under-shelf",
  "pegboard",
  "clip",
  "clips",
  "bracket",
  "adapter",
  "spacer",
  "divider",
  "label",
  "labels",
  "insert",
  "replacement",
];

const nicheWorkflowTerms = [
  "paint",
  "paintbrush",
  "miniature",
  "model",
  "dice",
  "crochet",
  "jewelry",
  "earring",
  "aquarium",
  "seedling",
  "greenhouse",
  "plant",
  "tool",
  "clamp",
  "cable",
  "sd card",
  "remote",
  "tea bag",
  "mason jar",
  "perfume sample",
  "laboratory",
  "test tube",
];

const weakGenericTerms = [
  "decor",
  "toy",
  "flexi",
  "dragon",
  "articulated",
  "figure",
  "figurine",
  "statue",
  "ornament",
  "gift",
  "novelty",
  "cute",
  "cool",
];

const seasonalTerms = ["christmas", "halloween", "easter", "valentine", "thanksgiving"];

const brandRiskTerms = [
  "airtag",
  "ad5x",
  "apple",
  "bambu",
  "bambulab",
  "cricut",
  "disney",
  "festool",
  "lego",
  "nintendo",
  "oral-b",
  "oxo",
  "peptide",
  "pokemon",
  "skadis",
  "star wars",
  "totoro",
  "xbox",
  "ipamorelin",
];

const strongCategories = ["Desk Accessories", "Kitchen", "Bathroom", "Workshop", "Tech Accessories", "Planters", "Jewelry"];

const giftTerms = ["personalized", "custom", "gift", "name", "desk", "plant", "jewelry", "pet", "teacher"];

export function salesLikelihood(product: SalesLikelihoodInput) {
  const text = [product.name, product.category, product.query, ...(product.tags || [])].join(" ").toLowerCase();
  const imageCount = product.imageCount || 0;
  let score = 45;
  const reasons: string[] = [];

  const utilityHits = highIntentTerms.filter((term) => text.includes(term));
  if (utilityHits.length) {
    score += Math.min(22, utilityHits.length * 5);
    reasons.push(`Practical search intent: ${utilityHits.slice(0, 4).join(", ")}.`);
  }

  const printNativeHits = printNativeTerms.filter((term) => text.includes(term));
  if (printNativeHits.length) {
    score += Math.min(18, printNativeHits.length * 4);
    reasons.push(`Strong 3D-print advantage: ${printNativeHits.slice(0, 4).join(", ")}.`);
  }

  const nicheHits = nicheWorkflowTerms.filter((term) => text.includes(term));
  if (nicheHits.length) {
    score += Math.min(16, nicheHits.length * 4);
    reasons.push(`Specific buyer workflow: ${nicheHits.slice(0, 4).join(", ")}.`);
  }

  if (strongCategories.includes(product.category)) {
    score += 12;
    reasons.push(`${product.category} is a strong Etsy category for functional 3D prints.`);
  }

  const giftHits = giftTerms.filter((term) => text.includes(term));
  if (giftHits.length) {
    score += Math.min(10, giftHits.length * 3);
    reasons.push(`Gift/custom angle present: ${giftHits.slice(0, 3).join(", ")}.`);
  }

  if (imageCount >= 8) {
    score += 10;
    reasons.push(`${imageCount} Etsy/source images gives the draft strong buyer trust.`);
  } else if (imageCount >= 5) {
    score += 5;
    reasons.push(`${imageCount} images meets the publish-ready photo floor.`);
  } else {
    score -= 18;
    reasons.push("Needs more listing images before it should be treated as high confidence.");
  }

  if (product.price !== null && product.price !== undefined) {
    if (product.price >= 12 && product.price <= 35) {
      score += 8;
      reasons.push(`Price point around $${Number(product.price).toFixed(2)} fits impulse/gift purchases.`);
    } else if (product.price < 12) {
      score -= 6;
      reasons.push("Low price may leave too little room for Etsy fees, labor, shipping friction, and ads.");
    } else if (product.price > 45) {
      score -= 8;
      reasons.push("Higher price may reduce conversion unless photos/options are excellent.");
    }
  }

  if (product.commercial_sale_allowed && product.license_type) {
    score += 8;
    reasons.push(`Commercial-safe source/license is recorded (${product.license_type}).`);
  }

  const weakHits = weakGenericTerms.filter((term) => text.includes(term));
  const hasOnlyWeakGiftLanguage = weakHits.length && utilityHits.length === 0 && nicheHits.length === 0;
  if (hasOnlyWeakGiftLanguage) {
    score -= 18;
    reasons.push(`Generic novelty/decor language without a clear use case: ${weakHits.slice(0, 3).join(", ")}.`);
  } else if (weakHits.length && !nicheHits.length) {
    score -= 7;
    reasons.push(`Needs a stronger buyer problem than: ${weakHits.slice(0, 3).join(", ")}.`);
  }

  const seasonalHits = seasonalTerms.filter((term) => text.includes(term));
  if (seasonalHits.length) {
    score -= 8;
    reasons.push(`Seasonal demand (${seasonalHits.slice(0, 2).join(", ")}) should be held for the right buying window or advertised carefully.`);
  }

  const brandRiskHits = brandRiskTerms.filter((term) => text.includes(term));
  if (brandRiskHits.length) {
    score -= 35;
    reasons.push(`Brand/IP review needed before publishing or advertising: ${brandRiskHits.slice(0, 3).join(", ")}.`);
  }

  if (product.rights_status === "Needs Review" || product.media_status === "Needs Review") {
    score -= 30;
    reasons.push("Held back because rights or media still need review.");
  }

  const finalScore = Math.max(1, Math.min(100, Math.round(score)));
  const band = finalScore >= 85 ? "High" : finalScore >= 70 ? "Good" : finalScore >= 55 ? "Medium" : "Low";
  const adGuidance =
    finalScore >= 90
      ? "Good first Etsy Ads candidate after title/photo review."
      : finalScore >= 80
        ? "Publish candidate; advertise only if early clicks/favorites look healthy."
        : finalScore >= 70
          ? "Keep as backup or organic-only until stronger photos/positioning are added."
          : "Do not advertise before improving niche fit, rights, media, or buyer clarity.";

  return {
    score: finalScore,
    notes: `${band} sell-likelihood (${finalScore}/100). ${reasons.join(" ")} ${adGuidance}`.slice(0, 1800),
  };
}
