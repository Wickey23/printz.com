import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { Box, Layers, WandSparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about PRINTZ Team Official and the custom 3D printed products behind the Etsy shop.",
};

export default function AboutPage() {
  const cards: { title: string; copy: string; Icon: LucideIcon }[] = [
    {
      title: "Design",
      copy: "Ideas are shaped around clean geometry, practical use, and a finish that looks good in real spaces.",
      Icon: WandSparkles,
    },
    {
      title: "Make",
      copy: "Products are printed or assembled in focused batches with room for custom details.",
      Icon: Box,
    },
    {
      title: "List",
      copy: "Finished items are showcased here and linked to Etsy listings when ready to purchase.",
      Icon: Layers,
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">About</p>
          <h1 className="mt-3 text-4xl font-black text-zinc-50 sm:text-5xl">Designed, tested, and made in small batches.</h1>
          <p className="mt-6 leading-8 text-zinc-300">
            PRINTZ Team Official is a small creative shop for custom 3D printed items, handmade pieces, desk accessories, collectibles, decor, and functional prints. This site is the catalog and portfolio; Etsy handles purchases and listing checkout.
          </p>
        </div>
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
          <img
            alt="Making process with tools and printed parts"
            className="h-full w-full object-cover"
            src="https://images.unsplash.com/photo-1581092334651-ddf26d9a09d0?auto=format&fit=crop&w=1200&q=80"
          />
        </div>
      </div>
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {cards.map(({ title, copy, Icon }) => (
          <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-6" key={title}>
            <Icon className="text-amber-200" size={24} />
            <h2 className="mt-5 text-xl font-bold text-zinc-50">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
