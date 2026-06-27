import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Box, CheckCircle2, Download, Hammer, PackageCheck, Sparkles } from "lucide-react";
import { HeroMediaWheel } from "@/components/hero-media-wheel";
import { ProductCard } from "@/components/product-card";
import { categories, siteConfig } from "@/lib/config";
import { getFeaturedProducts, getProductMediaForProducts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredProducts = await getFeaturedProducts();
  const mediaByProductId = await getProductMediaForProducts(featuredProducts.map((product) => product.id));

  return (
    <div>
      <section className="surface-grid border-b border-white/10">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-sm font-semibold text-amber-200">
              <Sparkles size={15} /> Digital downloads, 3D printed gifts, and custom ideas
            </p>
            <h1 className="text-5xl font-black leading-[1.02] text-zinc-50 sm:text-6xl lg:text-7xl">
              Useful designs for classrooms, desks, gifts, and everyday spaces.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300 sm:text-xl">
              PRINTZ By Khan is a small shop for printable classroom decor, digital product packs, and modern 3D printed pieces. Browse here, then check out securely on Etsy.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200"
                href="/products"
              >
                Shop Products <ArrowRight size={17} />
              </Link>
              <Link
                className="inline-flex h-12 items-center justify-center rounded-md border border-white/15 px-5 text-sm font-bold text-zinc-50 transition hover:border-amber-300/50"
                href="/suggest"
              >
                Suggest an Item
              </Link>
            </div>
            <div className="mt-8 grid gap-3 text-sm text-zinc-300 sm:grid-cols-3">
              <TrustPoint icon={<Download size={17} />} text="Instant digital files through Etsy" />
              <TrustPoint icon={<PackageCheck size={17} />} text="3D prints made and packed with care" />
              <TrustPoint icon={<CheckCircle2 size={17} />} text="Clear details before you buy" />
            </div>
          </div>
          <HeroMediaWheel products={featuredProducts} />
        </div>
      </section>

      <section className="border-b border-white/10 bg-zinc-900/45">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-3 lg:px-8">
          <StepCard step="1" title="Browse the catalog" text="Use this site to compare products, see what is digital versus physical, and read the details without Etsy clutter." />
          <StepCard step="2" title="Open the Etsy listing" text="Every ready-to-buy item links to PRINTZ By Khan on Etsy for secure checkout, downloads, and order messages." />
          <StepCard step="3" title="Download or receive it" text="Digital products are delivered by Etsy. Physical 3D prints are made to order and shipped through the shop." />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Featured</p>
            <h2 className="mt-3 text-3xl font-black text-zinc-50 sm:text-4xl">Ready to buy on Etsy</h2>
            <p className="mt-3 max-w-2xl leading-7 text-zinc-400">
              These listings are synced from the shop or curated here for quick browsing. Use the product page to jump to Etsy checkout.
            </p>
          </div>
          <Link className="hidden text-sm font-bold text-amber-200 sm:inline-flex" href="/products">
            View all products
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} media={mediaByProductId[product.id] || []} product={product} />
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-zinc-900/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">What We Make</p>
            <h2 className="mt-3 text-3xl font-black text-zinc-50 sm:text-4xl">
              Simple categories, clear expectations.
            </h2>
            <p className="mt-4 leading-7 text-zinc-400">
              Digital products are files you download and print. Physical products are 3D printed pieces made for desks, gifts, decor, and organization.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <div className="rounded-lg border border-white/10 bg-zinc-950 p-6" key={category}>
                <Box className="text-amber-200" size={24} />
                <h3 className="mt-5 text-lg font-bold text-zinc-50">{category}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  {categoryDescription(category)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Checkout</p>
          <h2 className="mt-3 text-3xl font-black text-zinc-50">The website explains. Etsy handles the order.</h2>
          <p className="mt-4 leading-7 text-zinc-400">
            PRINTZ listings on Etsy are mirrored into this website, so the catalog stays current while buyers still get Etsy purchase protection, downloads, messages, and receipts.
          </p>
          <a
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-md bg-zinc-50 px-5 text-sm font-bold text-zinc-950"
            href={siteConfig.etsyUrl}
            rel="noreferrer"
            target="_blank"
          >
            Visit Etsy Shop <ArrowRight size={17} />
          </a>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="aspect-video rounded-lg border border-white/10 bg-zinc-900 p-6">
            <Download className="text-amber-200" />
            <p className="mt-12 text-lg font-bold text-zinc-50">Digital downloads</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Printable PDFs, PNG packs, classroom decor, labels, templates, and teacher resources.</p>
          </div>
          <div className="aspect-video rounded-lg border border-white/10 bg-zinc-900 p-6">
            <Hammer className="text-amber-200" />
            <p className="mt-12 text-lg font-bold text-zinc-50">3D printed products</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">Desk organizers, practical tools, decor, custom colors, and giftable printed pieces.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrustPoint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-900/70 px-3 py-2">
      <span className="text-amber-200">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function StepCard({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-950 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-amber-300 text-sm font-black text-zinc-950">{step}</span>
        <h2 className="font-bold text-zinc-50">{title}</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}

function categoryDescription(category: string) {
  const descriptions: Record<string, string> = {
    "Desk Accessories": "Pen cups, trays, organizers, and desk upgrades for work, school, and teacher spaces.",
    Collectibles: "Giftable pieces and display items with personality, color options, and clean presentation.",
    Decor: "Wall art, small accents, classroom decor, and simple pieces that make a space feel finished.",
    "Functional Prints": "Practical 3D printed tools, holders, and organizers designed for everyday use.",
    "Digital Products": "Instant downloads such as printable posters, labels, classroom packs, and templates.",
    "Custom Orders": "Requests for custom colors, sizes, names, classroom needs, or new product ideas.",
    Seasonal: "Holiday, school-year, and gift-season products released when they make sense.",
  };

  return descriptions[category] || "Designed for clean finishes, useful details, and easy customization.";
}
