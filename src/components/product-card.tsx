import Link from "next/link";
import { ArrowRight, Download, Package, Sparkles } from "lucide-react";
import type { Product, ProductMedia } from "@/lib/types";
import { isRequestOnlyProduct } from "@/lib/product-flags";
import { formatPrice } from "@/lib/utils";

export function ProductCard({ media = [], product }: { media?: ProductMedia[]; product: Product }) {
  const isDigital = product.category === "Digital Products" || product.tags?.some((tag) => tag.toLowerCase().includes("digital"));
  const requestOnly = isRequestOnlyProduct(product);
  const gallery = productCardGallery(product, media);
  const heroImage = gallery.find((item) => item.type === "image")?.url;

  return (
    <article className="group overflow-hidden rounded-lg border border-white/10 bg-zinc-900/70 transition duration-300 hover:-translate-y-1 hover:border-amber-300/40">
      <Link href={`/products/${product.slug}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-zinc-800">
          {heroImage ? (
            <img
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              src={heroImage}
            />
          ) : (
            <div className="grid h-full place-items-center text-zinc-500">
              <Sparkles size={34} />
            </div>
          )}
          {gallery.length > 1 ? (
            <div className="absolute bottom-2 left-2 right-2 flex snap-x gap-1.5 overflow-x-auto rounded-md bg-zinc-950/75 p-1 backdrop-blur">
              {gallery.slice(0, 8).map((item) => (
                <span className="h-10 w-12 shrink-0 snap-start overflow-hidden rounded border border-white/10 bg-zinc-900" key={item.url}>
                  {item.type === "image" ? (
                    <img alt="" className="h-full w-full object-cover" src={item.url} />
                  ) : (
                    <video className="h-full w-full object-cover" muted src={item.url} />
                  )}
                </span>
              ))}
            </div>
          ) : null}
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {product.featured ? (
              <span className="rounded-md bg-amber-300 px-2.5 py-1 text-xs font-bold text-zinc-950">
                Featured
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-950/85 px-2.5 py-1 text-xs font-bold text-zinc-100">
              {isDigital ? <Download size={12} /> : <Package size={12} />}
              {isDigital ? "Digital" : "Physical"}
            </span>
            {product.etsy_listing_id ? (
              <span className="rounded-md bg-emerald-400/90 px-2.5 py-1 text-xs font-bold text-zinc-950">
                Synced from Etsy
              </span>
            ) : null}
            {requestOnly ? (
              <span className="rounded-md bg-amber-300/90 px-2.5 py-1 text-xs font-bold text-zinc-950">
                Request print
              </span>
            ) : !product.etsy_url ? (
              <span className="rounded-md bg-zinc-950/80 px-2.5 py-1 text-xs font-bold text-zinc-100">
                Coming soon
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4 p-5">
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                {product.category}
              </p>
              <p className="text-sm font-semibold text-zinc-100">{formatPrice(product.price)}</p>
            </div>
            <h3 className="mt-3 text-xl font-bold text-zinc-50">{product.name}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
              {product.short_description}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-amber-200">
            {requestOnly ? "Request this print" : product.etsy_url ? "View and buy" : "View details"} <ArrowRight size={16} />
          </span>
        </div>
      </Link>
    </article>
  );
}

function productCardGallery(product: Product, media: ProductMedia[]) {
  const items = [
    ...(product.main_image_url ? [{ type: "image" as const, url: product.main_image_url }] : []),
    ...media.map((item) => ({ type: item.media_type, url: item.url })),
  ];

  return items.filter((item, index, all) => isRenderableMediaUrl(item.url) && all.findIndex((candidate) => candidate.url === item.url) === index);
}

function isRenderableMediaUrl(url: string) {
  if (!url) return false;
  if (/drive\.google\.com\/drive\/folders\//i.test(url)) return false;
  return /^https?:\/\//i.test(url) || url.startsWith("/");
}
