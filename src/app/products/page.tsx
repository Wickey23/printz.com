import type { Metadata } from "next";
import { ProductBrowser } from "@/components/product-browser";
import { getProductMediaForProducts, getProducts } from "@/lib/data";

export const metadata: Metadata = {
  title: "Products",
  description: "Browse 3D printed products, digital downloads, and source-model prints you can request from PRINTZ.",
};

export default async function ProductsPage() {
  const products = await getProducts();
  const mediaByProductId = await getProductMediaForProducts(products.map((product) => product.id));

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Catalog</p>
        <h1 className="mt-3 text-4xl font-black text-zinc-50 sm:text-5xl">Products</h1>
        <p className="mt-4 leading-7 text-zinc-400">
          Browse ready Etsy listings and request-only source-model prints. Request-only products are reviewed, quoted, and converted into a custom Etsy checkout before production.
        </p>
      </div>
      <ProductBrowser mediaByProductId={mediaByProductId} products={products} />
    </section>
  );
}
