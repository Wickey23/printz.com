import { revalidatePath } from "next/cache";
import { seedChatsListProductDrafts } from "@/lib/chats-list-drafts";
import { createOrSyncEtsyListing, etsyListingRequirements } from "@/lib/etsy-listings";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken } from "@/lib/etsy-auth";
import { getEtsyReadiness } from "@/lib/etsy-readiness";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { Product, ProductMedia } from "@/lib/types";

export type EtsyDraftAutomationResult = {
  ok: boolean;
  message: string;
  checked: number;
  created: number;
  skipped: number;
  failed: number;
  failures: string[];
  chatsListSeed?: {
    checked: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
};

export async function createMissingEtsyDrafts({
  dryRun = false,
  limit = 20,
}: {
  dryRun?: boolean;
  limit?: number;
} = {}): Promise<EtsyDraftAutomationResult> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return emptyResult("Supabase service role key is required.", false);
  }

  const [etsyToken, settings] = await Promise.all([getValidEtsyOAuthToken(), getEffectiveEtsyRuntimeSettings()]);
  const accessToken = etsyToken?.access_token || process.env.ETSY_ACCESS_TOKEN || "";
  const chatsListSeed = await seedChatsListProductDrafts({ limit, supabase }).catch((error) => ({
    checked: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 1,
    failures: [error instanceof Error ? error.message : "Chats List product seeding failed."],
  }));

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .is("etsy_listing_id", null)
    .or("etsy_url.is.null,etsy_url.eq.")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 50)));

  if (error) return emptyResult(error.message, false);

  const products = (data || []) as Product[];
  let created = 0;
  let skipped = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const product of products) {
    const media = await productMedia(supabase, product.id);
    const imageCount = media.filter((item) => item.media_type === "image").length + (product.main_image_url ? 1 : 0);
    const readiness = getEtsyReadiness(product, { imageCount });
    const requirements = etsyListingRequirements(product, { hasOAuthToken: Boolean(accessToken), settings });

    if (requirements.length || !readiness.readyToDraft) {
      skipped++;
      continue;
    }

    if (dryRun) {
      created++;
      continue;
    }

    try {
      const result = await createOrSyncEtsyListing({
        apiKey: process.env.ETSY_API_KEY!,
        accessToken,
        settings,
        product,
        media,
        publish: false,
      });

      const { error: updateError } = await supabase
        .from("products")
        .update({
          etsy_listing_id: result.listingId,
          etsy_url: result.url,
          etsy_state: result.state || "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (updateError) throw updateError;
      created++;
    } catch (error) {
      failed++;
      failures.push(`${product.name}: ${error instanceof Error ? error.message : "Unknown Etsy draft error"}`);
    }
  }

  if (!dryRun && created) {
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/admin");
    revalidatePath("/admin/etsy");
  }

  return {
    ok: failed === 0,
    message: `${dryRun ? "Dry run found" : "Created/synced"} ${created} Etsy draft${created === 1 ? "" : "s"}. Skipped ${skipped}. Failed ${failed}. Chats List seed created ${chatsListSeed.created}, updated ${chatsListSeed.updated}, failed ${chatsListSeed.failed}.`,
    checked: products.length,
    created,
    skipped,
    failed,
    failures: [...(chatsListSeed.failures || []), ...failures],
    chatsListSeed: {
      checked: chatsListSeed.checked,
      created: chatsListSeed.created,
      updated: chatsListSeed.updated,
      skipped: chatsListSeed.skipped,
      failed: chatsListSeed.failed,
    },
  };
}

async function productMedia(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, productId: string) {
  const { data } = await supabase
    .from("product_media")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  return (data || []) as ProductMedia[];
}

function emptyResult(message: string, ok: boolean): EtsyDraftAutomationResult {
  return {
    ok,
    message,
    checked: 0,
    created: 0,
    skipped: 0,
    failed: ok ? 0 : 1,
    failures: ok ? [] : [message],
  };
}
