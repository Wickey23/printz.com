import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { requireAdmin } from "@/lib/auth";
import { getProductByIdForAdmin, getProductMedia } from "@/lib/data";

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

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
        <h1 className="mt-2 text-4xl font-black text-zinc-50">Edit product</h1>
      </div>
      <ProductForm galleryMediaUrls={media.map((item) => item.url)} product={product} />
    </section>
  );
}
