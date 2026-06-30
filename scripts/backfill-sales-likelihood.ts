import { createSupabaseAdminClient } from "../src/lib/supabase/server";
import { salesLikelihood } from "../src/lib/sales-likelihood";
import type { Product, ProductMedia } from "../src/lib/types";

async function main() {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase service role key is required.");

  await assertSalesLikelihoodColumns(supabase);

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
    if (updateError) {
      if (isMissingSalesLikelihoodColumns(updateError)) throw missingColumnsError(updateError);
      throw updateError;
    }
    updated++;
  }

  console.log(JSON.stringify({ updated }, null, 2));
}

async function assertSalesLikelihoodColumns(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { error } = await supabase.from("products").select("id,sales_likelihood_score,sales_likelihood_notes").limit(1);
  if (error) {
    if (isMissingSalesLikelihoodColumns(error)) throw missingColumnsError(error);
    throw error;
  }
}

function isMissingSalesLikelihoodColumns(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return maybeError.code === "PGRST204" || /sales_likelihood_(score|notes)/i.test(maybeError.message || "");
}

function missingColumnsError(cause: unknown) {
  return new Error(
    [
      "Supabase is missing the sales likelihood columns or its API schema cache has not refreshed.",
      "Run supabase/sales_likelihood_notes.sql in the Supabase SQL editor, then run this script again.",
      "The migration now includes: notify pgrst, 'reload schema';",
      `Original error: ${cause instanceof Error ? cause.message : JSON.stringify(cause)}`,
    ].join("\n"),
  );
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
