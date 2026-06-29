import { createSupabaseAdminClient } from "../src/lib/supabase/server";
import { salesLikelihood } from "../src/lib/sales-likelihood";
import type { Product, ProductMedia } from "../src/lib/types";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role key is required.");

  const { data: products, error } = await supabase.from("products").select("*").limit(1000);
  if (error) throw error;

  let updated = 0;
  for (const product of (products || []) as Product[]) {
    const media = await productMedia(supabase, product.id);
    const imageCount = new Set([product.main_image_url, ...media.filter((item) => item.media_type === "image").map((item) => item.url)].filter(Boolean)).size;
    const sales = salesLikelihood({ ...product, imageCount });
    const { error: updateError } = await supabase
      .from("products")
      .update({
        sales_likelihood_score: sales.score,
        sales_likelihood_notes: sales.notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    if (updateError) throw updateError;
    updated++;
  }

  console.log(JSON.stringify({ updated }, null, 2));
}

async function productMedia(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productId: string) {
  const { data, error } = await supabase.from("product_media").select("*").eq("product_id", productId).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []) as ProductMedia[];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
