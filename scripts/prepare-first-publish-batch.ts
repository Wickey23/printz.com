import fs from "node:fs/promises";
import path from "node:path";
import { createSupabaseAdminClient } from "../src/lib/supabase/server";
import { salesLikelihood } from "../src/lib/sales-likelihood";
import type { Product, ProductMedia } from "../src/lib/types";

const batchTag = "first-publish-batch";
const batchDateTag = "first-publish-batch-2026-06-30";
const adsTag = "etsy-ads-test";

const blockedTerms = [
  "airtag",
  "ad5x",
  "a1 mini",
  "apple",
  "bambu",
  "bambulab",
  "betem",
  "commercial use",
  "cricut",
  "disney",
  "dragon",
  "festool",
  "flexi",
  "hanson",
  "ipamorelin",
  "knipex",
  "lego",
  "nintendo",
  "oral-b",
  "oxo",
  "peptide",
  "pokemon",
  "poop",
  "prank",
  "skadis",
  "star wars",
  "totoro",
  "xbox",
];

const firstBatchAvoidTerms = [
  "3kg spool",
  "18650",
  "ant ",
  "bathroom gadgets",
  "beer battery",
  "breakout board",
  "booktok",
  "boho",
  "bowl",
  "cat pen",
  "coin cell",
  "digestion",
  "fastener",
  "fish feeder",
  "filament",
  "fuse",
  "hose clamp",
  "lab ",
  "laboratory",
  "medical",
  "medicine",
  "motorcycle",
  "oil filter",
  "model paint",
  "pill",
  "ptfe",
  "snail feeder",
  "socket mug",
  "stethoscope",
  "test tube",
  "tube rack",
  "vial",
];

const positiveClusters = [
  { key: "craft", terms: ["paintbrush", "paint brush", "paint marker", "marker holder", "paint palette", "brush stand", "brush holder", "bead", "yarn", "crochet", "knitting", "cross stitch", "floss", "earring", "jewelry"] },
  { key: "home", terms: ["remote", "caddy", "tea", "mason jar", "soap", "toothpaste", "makeup", "spice", "cutting board", "chopping board", "egg", "fridge", "drawer", "closet", "label", "cord"] },
  { key: "plant", terms: ["plant", "seedling", "greenhouse", "rooting", "planter", "hydroponic", "garden"] },
  { key: "workspace", terms: ["desk", "file sorter", "letter organizer", "cable", "sd card", "headphone", "tablet", "book", "business card", "sticky notes"] },
  { key: "workshop", terms: ["pegboard", "clamp", "screw", "hex bit", "bolt", "tool drawer", "tool"] },
];

const friendlyTitles: Record<string, string> = {
  "clips for other vegetables in the greenhouse": "Greenhouse Plant Support Clips",
  "clips for other vegetables plant in the greenhouse": "Greenhouse Plant Support Clips",
  "customizable & stackable beer crate for all types of batteries": "Stackable Battery Storage Crate",
  "long & short earrings display stand - 18min print!": "Adjustable Earring Display Stand",
  "openscad custom pegboard bin labels": "Custom Pegboard Bin Labels",
  "openscad plant label stakes personalized": "Personalized Plant Label Stakes",
  "parametrized tea bag holder. wall/under shelf mount": "Adjustable Wall or Under-Shelf Tea Bag Holder",
  "aquarium clip - glass": "Aquarium Glass Clip",
  "brush stand": "Paint Brush Stand",
  "headphone holder": "Wall-Mounted Headphone Holder",
  "magnetic wall organizer - no supports - 25mm x 6mm magnets": "Magnetic Wall Organizer",
  "makeup pencil stand / holder / organizer": "Makeup Pencil Organizer",
  "paintbrush holder and paint palette dish": "Paintbrush Holder and Paint Palette Dish",
  "soap dish (always dry soap)": "Always-Dry Soap Dish",
  "stackable organizer assortment box with lid #1": "Stackable Organizer Box with Lid",
  "wall mountable headphone hand stand": "Wall-Mounted Headphone Stand",
  "yarns stand/holder/un-winder": "Yarn Holder and Unwinder Stand",
};

type Candidate = {
  product: Product;
  imageCount: number;
  score: number;
  notes: string;
  cluster: string;
  title: string;
};

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role key is required.");

  const { data, error } = await supabase.from("products").select("*").limit(2000);
  if (error) throw error;

  const products = (data || []) as Product[];
  const mediaByProduct = await mediaForProducts(supabase, products.map((product) => product.id));
  const candidates = products
    .map((product) => toCandidate(product, mediaByProduct[product.id] || []))
    .filter((candidate): candidate is Candidate => Boolean(candidate))
    .sort((a, b) => b.score - a.score || b.imageCount - a.imageCount || Number(b.product.price || 0) - Number(a.product.price || 0));

  const selected = diversify(candidates, 50);
  await clearPreviousBatchTags(supabase, products);
  await markSelectedProducts(supabase, selected);
  const report = buildReport(selected, candidates.length);
  const outputPath = path.join(process.cwd(), "reports", "etsy-first-publish-batch-top50-2026-06-30.md");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, report);

  console.log(JSON.stringify({ candidates: candidates.length, selected: selected.length, outputPath }, null, 2));
}

function toCandidate(product: Product, media: ProductMedia[]): Candidate | null {
  const text = [product.name, product.category, product.short_description, product.full_description, ...(product.tags || [])].join(" ").toLowerCase();
  if (!product.active || !product.etsy_url?.includes("etsy.com")) return null;
  if (!product.source_url || !product.license_notes) return null;
  if (product.commercial_sale_allowed === false) return null;
  if (product.rights_status === "Needs Review" || product.media_status === "Needs Review" || product.trademark_review_status === "Needs Review") return null;
  if (!/^[\x00-\x7F]*$/.test(product.name)) return null;
  if (blockedTerms.some((term) => text.includes(term))) return null;
  if (firstBatchAvoidTerms.some((term) => text.includes(term))) return null;

  const imageCount = imageCountFor(product, media);
  if (imageCount < 5) return null;

  const cluster = clusterFor(text);
  if (!cluster) return null;

  const computed = salesLikelihood({ ...product, imageCount });
  const practicalBonus = cluster === "craft" || cluster === "home" ? 5 : 0;
  const score = Math.min(100, computed.score + practicalBonus);
  if (score < 88) return null;

  return {
    product,
    imageCount,
    score,
    notes: computed.notes,
    cluster,
    title: friendlyTitle(product.name),
  };
}

function diversify(candidates: Candidate[], limit: number) {
  const selected: Candidate[] = [];
  const clusterCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const seenNames = new Set<string>();

  for (const candidate of candidates) {
    const key = dedupeKey(candidate.title);
    if (seenNames.has(key)) continue;
    const clusterCount = clusterCounts.get(candidate.cluster) || 0;
    const categoryCount = categoryCounts.get(candidate.product.category) || 0;
    if (clusterCount >= 14 || categoryCount >= 12) continue;
    selected.push(candidate);
    seenNames.add(key);
    clusterCounts.set(candidate.cluster, clusterCount + 1);
    categoryCounts.set(candidate.product.category, categoryCount + 1);
    if (selected.length >= limit) return selected;
  }

  for (const candidate of candidates) {
    const key = dedupeKey(candidate.title);
    if (seenNames.has(key)) continue;
    selected.push(candidate);
    seenNames.add(key);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

async function clearPreviousBatchTags(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, products: Product[]) {
  const previouslyTagged = products.filter((product) => product.tags?.includes(batchTag) || product.tags?.includes(batchDateTag) || product.tags?.includes(adsTag));
  for (const product of previouslyTagged) {
    const tags = (product.tags || []).filter((tag) => ![batchTag, batchDateTag, adsTag].includes(tag));
    await updateProduct(supabase, product.id, { tags });
  }
}

async function markSelectedProducts(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, selected: Candidate[]) {
  for (const [index, candidate] of selected.entries()) {
    const rank = index + 1;
    const baseTags = (candidate.product.tags || []).filter((tag) => ![batchTag, batchDateTag, adsTag].includes(tag));
    const tags = unique([...baseTags, batchTag, batchDateTag, ...(rank <= 15 ? [adsTag] : [])]);
    const launchNote = [
      `FIRST PUBLISH BATCH RANK ${rank}/50.`,
      rank <= 15 ? "Use for the first Etsy Ads test after final photo/title review." : "Publish after the first ads group is reviewed.",
      `Cluster: ${candidate.cluster}. Images: ${candidate.imageCount}.`,
      `Recommended public title: ${candidate.title}.`,
      candidate.notes.replace(/^High sell-likelihood \(\d+\/100\)\.\s*/i, "").replace(/^Good sell-likelihood \(\d+\/100\)\.\s*/i, ""),
    ].join(" ");

    await updateProduct(supabase, candidate.product.id, {
      tags,
      sales_likelihood_score: candidate.score,
      sales_likelihood_notes: launchNote.slice(0, 2000),
    });
  }
}

async function updateProduct(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, id: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("products").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

function buildReport(selected: Candidate[], candidateCount: number) {
  const rows = selected
    .map((candidate, index) => {
      const rank = index + 1;
      const product = candidate.product;
      const action = rank <= 15 ? "Ads test" : rank <= 25 ? "Publish first" : "Publish second";
      return `| ${rank} | ${cell(candidate.title)} | ${cell(candidate.cluster)} | ${cell(product.category)} | $${Number(product.price || 0).toFixed(2)} | ${candidate.score} | ${candidate.imageCount} | ${action} | ${product.etsy_url || ""} |`;
    })
    .join("\n");

  return `# PRINTZ First Publish Batch - Top 50

Generated: ${new Date().toISOString()}

These products are prepared in the PRINTZ admin database with the tags \`${batchTag}\` and \`${batchDateTag}\`. The top 15 also have \`${adsTag}\`.

Candidate pool after first-batch filters: ${candidateCount}

| Rank | Product | Cluster | Category | Price | Score | Images | Action | Etsy Draft |
|---:|---|---|---|---:|---:|---:|---|---|
${rows}

## Posting Plan

Publish ranks 1-25 first. Start Etsy Ads only on ranks 1-15 after checking the first photo, title, shipping, and attribution in Etsy. Publish ranks 26-50 after 3-5 days if there are no policy, image, attribution, or fulfillment issues.
`;
}

function clusterFor(text: string) {
  const hit = positiveClusters.find((cluster) => cluster.terms.some((term) => text.includes(term)));
  return hit?.key || "";
}

function friendlyTitle(name: string) {
  return friendlyTitles[name.toLowerCase()] || name.replace(/^openscad\s+/i, "").replace(/\s+-?\s*3d printed gift.*$/i, "").trim();
}

function dedupeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(custom|personalized|holder|organizer|stand|tray|set|box)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function cell(value: string) {
  return value.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
