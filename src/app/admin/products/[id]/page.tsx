import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { EtsyListingSyncPanel } from "@/components/etsy-listing-sync-panel";
import { DriveMediaImportPanel } from "@/components/drive-media-import-panel";
import { AiEtsyAutofillPanel } from "@/components/ai-etsy-autofill-panel";
import { requireAdmin } from "@/lib/auth";
import { getProductByIdForAdmin, getProductMedia } from "@/lib/data";
import { salesLikelihood } from "@/lib/sales-likelihood";
import type { ProductMedia } from "@/lib/types";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditProductPage({ params }: Props) {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  const { id } = await params;
  const product = await getProductByIdForAdmin(id);
  if (!product) notFound();
  const media = await getProductMedia(product.id);
  const imageCount = media.filter((item) => item.media_type === "image").length + (product.main_image_url ? 1 : 0);

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
        <h1 className="mt-2 text-4xl font-black text-zinc-50">Edit product</h1>
      </div>
      <div className="grid gap-5">
        <SalesLikelihoodPanel imageCount={imageCount} media={media} product={product} />
        <DriveMediaImportPanel imageCount={imageCount} product={product} />
        <AiEtsyAutofillPanel product={product} />
        <EtsyListingSyncPanel imageCount={imageCount} product={product} />
        <ProductForm galleryMediaUrls={media.map((item) => item.url)} product={product} />
      </div>
    </section>
  );
}

function SalesLikelihoodPanel({ imageCount, media, product }: { imageCount: number; media: ProductMedia[]; product: Awaited<ReturnType<typeof getProductByIdForAdmin>> }) {
  if (!product) return null;
  const computed = salesLikelihood({ ...product, imageCount: new Set([product.main_image_url, ...media.filter((item) => item.media_type === "image").map((item) => item.url)].filter(Boolean)).size || imageCount });
  const score = product.sales_likelihood_score || computed.score;
  const notes = product.sales_likelihood_notes || computed.notes;
  return (
    <section className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-200">Admin sales notes</p>
          <h2 className="mt-2 text-2xl font-black text-zinc-50">Sell score {score}/100</h2>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-emerald-50">
        {notes}
      </p>
    </section>
  );
}
