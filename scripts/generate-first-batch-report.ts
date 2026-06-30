import fs from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "../src/lib/supabase/server";
import { salesLikelihood } from "../src/lib/sales-likelihood";
import type { Product, ProductMedia } from "../src/lib/types";

const blockedTerms = [
  "airtag",
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
  "pokemon",
  "skadis",
  "star wars",
  "totoro",
  "xbox",
  "christmas",
  "halloween",
  "flexi",
  "dragon",
  "articulated",
  "ad5x",
  "ipamorelin",
  "peptide",
  "toy",
];

const cleanupSuggestions: Record<string, string> = {
  "customizable & stackable beer crate for all types of batteries": "Stackable Battery Storage Crate",
  "long & short earrings display stand - 18min print!": "Adjustable Earring Display Stand",
  "parametrized tea bag holder": "Adjustable Tea Bag Holder",
  "parametrized tea bag holder. wall/under shelf mount": "Adjustable Wall or Under-Shelf Tea Bag Holder",
  "wall mountable headphone hand stand": "Wall-Mounted Headphone Stand",
  "clips for other vegetables in the greenhouse": "Greenhouse Plant Support Clips",
  "clips for other vegetables plant in the greenhouse": "Greenhouse Plant Support Clips",
  "y-crochet hook": "Crochet Hook Organizer",
  "aquarium clip - glass": "Aquarium Glass Clip",
  "yarns stand/holder/un-winder": "Yarn Holder and Unwinder Stand",
  "seedling signs - keep track of your plantations": "Seedling Label Signs",
  "openscad custom pegboard bin labels": "Custom Pegboard Bin Labels",
  "openscad plant label stakes personalized": "Personalized Plant Label Stakes",
};

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role key is required.");

  const { data: products, error } = await supabase.from("products").select("*").limit(2000);
  if (error) throw error;

  const productRows = ((products || []) as Product[]).filter(cleanProduct);
  const mediaByProduct = await mediaForProducts(supabase, productRows.map((product) => product.id));
  const ranked = productRows
    .map((product) => {
      const media = mediaByProduct[product.id] || [];
      const imageCount = imageCountFor(product, media);
      const sales = salesLikelihood({ ...product, imageCount });
      return { product, imageCount, sales };
    })
    .filter((item) => item.imageCount >= 5 && item.sales.score >= 80)
    .sort((a, b) => b.sales.score - a.sales.score || b.imageCount - a.imageCount || String(b.product.updated_at).localeCompare(String(a.product.updated_at)));

  const selected = diversify(dedupeSimilarProducts(ranked), 50);
  const report = reportMarkdown(selected, productRows.length, ranked.length);
  const outputPath = path.join(process.cwd(), "reports", "etsy-first-batch-top50-2026-06-30.md");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, report);

  console.log(JSON.stringify({ cleanPool: productRows.length, rankedPool: ranked.length, selected: selected.length, outputPath }, null, 2));
}

function cleanProduct(product: Product) {
  const text = [product.name, product.category, ...(product.tags || [])].join(" ").toLowerCase();
  if (!product.active || !product.etsy_url?.includes("etsy.com")) return false;
  if (product.rights_status === "Needs Review" || product.media_status === "Needs Review") return false;
  if (product.trademark_review_status === "Needs Review") return false;
  if (product.commercial_sale_allowed === false) return false;
  if (!product.source_url || !product.license_notes) return false;
  if (blockedTerms.some((term) => text.includes(term))) return false;
  return /^[\x00-\x7F]*$/.test(product.name);
}

function diversify<T extends { product: Product }>(items: T[], limit: number) {
  const selected: T[] = [];
  const categoryCounts = new Map<string, number>();
  const firstPassLimit = 9;

  for (const item of items) {
    const count = categoryCounts.get(item.product.category) || 0;
    if (count >= firstPassLimit) continue;
    selected.push(item);
    categoryCounts.set(item.product.category, count + 1);
    if (selected.length >= limit) return selected;
  }

  for (const item of items) {
    if (selected.some((selectedItem) => selectedItem.product.id === item.product.id)) continue;
    selected.push(item);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

function dedupeSimilarProducts<T extends { product: Product; sales: { score: number }; imageCount: number }>(items: T[]) {
  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const item of items) {
    const key = friendlyTitle(item.product.name)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\b(3d|printed|printz|by|khan|set|custom|personalized)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function imageCountFor(product: Product, media: ProductMedia[]) {
  return new Set([product.main_image_url, ...media.filter((item) => item.media_type === "image").map((item) => item.url)].filter(Boolean)).size;
}

async function mediaForProducts(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productIds: string[]) {
  const byProduct: Record<string, ProductMedia[]> = {};
  for (let index = 0; index < productIds.length; index += 100) {
    const batch = productIds.slice(index, index + 100);
    const { data, error } = await supabase.from("product_media").select("*").in("product_id", batch).order("sort_order", { ascending: true });
    if (error) throw error;
    for (const item of (data || []) as ProductMedia[]) {
      byProduct[item.product_id] ||= [];
      byProduct[item.product_id].push(item);
    }
  }
  return byProduct;
}

function reportMarkdown(items: Array<{ product: Product; imageCount: number; sales: { score: number; notes: string } }>, cleanPool: number, rankedPool: number) {
  const rows = items
    .map((item, index) => {
      const product = item.product;
      const title = friendlyTitle(product.name);
      const cleanup = title === product.name ? "Ready" : `Rename to: ${title}`;
      return `| ${index + 1} | ${cell(title)} | ${cell(product.category)} | $${Number(product.price || 0).toFixed(2)} | ${item.sales.score} | ${item.imageCount} | ${cell(cleanup)} | ${product.etsy_url || ""} |`;
    })
    .join("\n");

  return `# PRINTZ Etsy First Batch Approval - Top 50

Generated: ${new Date().toISOString()}

Current clean pool considered: ${cleanPool}
Ad/publish-worthy pool after tightened scoring: ${rankedPool}
Recommended first publish batch: 50

Selection rules:
- Useful before decorative: organizers, holders, clips, labels, racks, mounts, shelves, trays, caddies, and workflow tools.
- Strong 3D-print advantage: custom-fit, adjustable, modular, stackable, wall-mounted, exact-size, or niche workflow.
- No obvious brand/IP risk, no unclear rights, no missing source/license notes.
- At least 5 images, with priority for 8-10 images.
- Etsy Ads should start only on the best 10-15 after title/photo review.

| Rank | Product | Category | Price | Score | Images | Launch cleanup | Etsy Draft |
|---:|---|---|---:|---:|---:|---|---|
${rows}

## Launch Recommendation

Publish the first 25 immediately after final human review, then publish the next 25 after 3-5 days if no Etsy policy, image, attribution, or shipping issues appear.

For ads, start with the top 10-15 only. Do not advertise seasonal, generic decor, brand-adjacent, or low-margin products until they show organic clicks/favorites.
`;
}

function friendlyTitle(name: string) {
  return cleanupSuggestions[name.toLowerCase()] || name.replace(/\s+-?\s*3d printed gift.*$/i, "").trim();
}

function cell(value: string) {
  return value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
