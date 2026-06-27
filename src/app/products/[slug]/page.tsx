import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Download, Mail, Package, Palette, Ruler, ShieldCheck, Sparkles, Wand2 } from "lucide-react";
import { ProductMediaCarousel } from "@/components/product-media-carousel";
import { getProductBySlug, getProductMedia } from "@/lib/data";
import { isRequestOnlyProduct, requestPrintHref } from "@/lib/product-flags";
import type { ProductMedia } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

type Props = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    description: product.short_description,
    openGraph: {
      title: product.name,
      description: product.short_description,
      images: product.main_image_url ? [product.main_image_url] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const media = await getProductMedia(product.id);
  const gallery = buildProductGallery(product.main_image_url, media);
  const isDigital = product.category === "Digital Products" || product.tags?.some((tag) => tag.toLowerCase().includes("digital"));
  const requestOnly = isRequestOnlyProduct(product);
  const requestHref = requestPrintHref(product);
  const hasCustomization =
    product.personalization_enabled ||
    Boolean(product.customization_notes) ||
    Boolean(product.personalization_prompt) ||
    Boolean(product.color_options?.length) ||
    Boolean(product.size_options?.length) ||
    Boolean(product.finish_options?.length) ||
    Boolean(product.processing_time) ||
    Boolean(product.care_instructions);

  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <ProductMediaCarousel items={gallery} productName={product.name} />

      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">{product.category}</p>
        <h1 className="mt-3 text-4xl font-black text-zinc-50 sm:text-5xl">{product.name}</h1>
        <p className="mt-4 text-xl font-bold text-zinc-200">{formatPrice(product.price)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-zinc-800 px-3 py-1 text-sm font-bold">
            {isDigital ? <Download size={14} /> : <Package size={14} />}
            {isDigital ? "Digital download" : "Physical item"}
          </span>
          {product.etsy_listing_id ? <span className="rounded-md bg-emerald-400/15 px-3 py-1 text-sm font-bold text-emerald-200">Synced from Etsy</span> : null}
          {requestOnly ? <span className="rounded-md bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-100">Request before printing</span> : null}
          {!requestOnly && !product.etsy_url ? <span className="rounded-md bg-zinc-800 px-3 py-1 text-sm font-bold">Coming Soon</span> : null}
          {hasCustomization ? (
            <span className="rounded-md bg-amber-300/10 px-3 py-1 text-sm font-bold text-amber-200">
              Custom options available
            </span>
          ) : null}
        </div>
        <p className="mt-6 leading-8 text-zinc-300">{product.full_description || product.short_description}</p>

        <div className="mt-6 rounded-lg border border-amber-300/20 bg-amber-300/[0.06] p-5">
          <div className="flex items-center gap-2 font-bold text-zinc-50">
            <ShieldCheck className="text-amber-200" size={19} />
            {requestOnly ? "Request this print before checkout" : "Checkout happens on Etsy"}
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            {requestOnly
              ? "This model needs a quick printability and license review before production. Submit a request with your material, color, quantity, and shipping details; we will quote it and send a custom Etsy checkout link."
              : isDigital
              ? "After purchase, Etsy provides the download files through your Etsy account or email receipt."
              : "Use Etsy for secure checkout, order messages, shipping updates, and shop support."}
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <Detail title="Materials" value={product.materials} />
          <Detail title="Dimensions" value={product.dimensions} />
          <Detail title="License / seller notes" value={product.license_notes || null} />
        </div>

        {hasCustomization ? (
          <section className="mt-8 rounded-lg border border-white/10 bg-zinc-900/70 p-5">
            <div className="flex items-center gap-2">
              <Wand2 className="text-amber-200" size={20} />
              <h2 className="text-xl font-black text-zinc-50">Customization options</h2>
            </div>
            {product.customization_notes ? <p className="mt-3 leading-7 text-zinc-300">{product.customization_notes}</p> : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {product.personalization_enabled ? (
                <OptionCard
                  icon={<Wand2 size={17} />}
                  title="Personalization"
                  value={product.personalization_prompt || "Personalized requests are available. Add details on Etsy before checkout."}
                />
              ) : null}
              <OptionList icon={<Palette size={17} />} title="Colors" values={product.color_options || []} />
              <OptionList icon={<Ruler size={17} />} title="Sizes" values={product.size_options || []} />
              <OptionList icon={<Sparkles size={17} />} title="Finishes" values={product.finish_options || []} />
              <OptionCard icon={<Package size={17} />} title="Processing time" value={product.processing_time || null} />
              <OptionCard icon={<ShieldCheck size={17} />} title="Care instructions" value={product.care_instructions || null} />
            </div>
          </section>
        ) : null}

        {product.video_url ? (
          <a className="mt-6 inline-flex text-sm font-bold text-amber-200" href={product.video_url} rel="noreferrer" target="_blank">
            View product video <ArrowUpRight size={16} />
          </a>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {requestOnly ? (
            <Link
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200"
              href={requestHref}
            >
              Request this print <ArrowUpRight size={17} />
            </Link>
          ) : (
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200"
              href={product.etsy_url || "#"}
              rel="noreferrer"
              target={product.etsy_url ? "_blank" : undefined}
            >
              {product.etsy_url ? "Buy on Etsy" : "Listing Coming Soon"} <ArrowUpRight size={17} />
            </a>
          )}
          <Link
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/15 px-5 text-sm font-bold text-zinc-50"
            href={`/suggest?similar=${product.slug}`}
          >
            <Mail size={17} /> Suggest something similar
          </Link>
          {product.source_url ? (
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/15 px-5 text-sm font-bold text-zinc-50"
              href={product.source_url}
              rel="noreferrer"
              target="_blank"
            >
              Source listing <ArrowUpRight size={17} />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function buildProductGallery(mainImageUrl: string | null, media: ProductMedia[]) {
  const items: Array<{ media_type: ProductMedia["media_type"]; url: string }> = [
    ...(mainImageUrl ? [{ media_type: "image" as const, url: mainImageUrl }] : []),
    ...media.map((item) => ({ media_type: item.media_type, url: item.url })),
  ];

  return items.filter((item, index, all) => isRenderableMediaUrl(item.url) && all.findIndex((candidate) => candidate.url === item.url) === index);
}

function isRenderableMediaUrl(url: string) {
  if (!url) return false;
  if (/drive\.google\.com\/drive\/folders\//i.test(url)) return false;
  return /^https?:\/\//i.test(url) || url.startsWith("/");
}

function Detail({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">{title}</h2>
      <p className="mt-2 leading-7 text-zinc-200">{value}</p>
    </div>
  );
}

function OptionCard({ icon, title, value }: { icon: ReactNode; title: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">
        <span className="text-amber-200">{icon}</span>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-200">{value}</p>
    </div>
  );
}

function OptionList({ icon, title, values }: { icon: ReactNode; title: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">
        <span className="text-amber-200">{icon}</span>
        {title}
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <span className="rounded-md bg-white/5 px-2.5 py-1 text-sm font-semibold text-zinc-200" key={value}>
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}
