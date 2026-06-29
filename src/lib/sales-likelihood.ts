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
    } else if (product.price > 45) {
      score -= 8;
      reasons.push("Higher price may reduce conversion unless photos/options are excellent.");
    }
  }

  if (product.commercial_sale_allowed && product.license_type) {
    score += 8;
    reasons.push(`Commercial-safe source/license is recorded (${product.license_type}).`);
  }

  if (product.rights_status === "Needs Review" || product.media_status === "Needs Review") {
    score -= 30;
    reasons.push("Held back because rights or media still need review.");
  }

  const finalScore = Math.max(1, Math.min(100, Math.round(score)));
  const band = finalScore >= 85 ? "High" : finalScore >= 70 ? "Good" : finalScore >= 55 ? "Medium" : "Low";

  return {
    score: finalScore,
    notes: `${band} sell-likelihood (${finalScore}/100). ${reasons.join(" ")}`.slice(0, 1800),
  };
}
