"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Download, Package, Search, Sparkles } from "lucide-react";
import { categories } from "@/lib/config";
import { isRequestOnlyProduct } from "@/lib/product-flags";
import type { Product, ProductMedia } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

export function ProductBrowser({
  mediaByProductId = {},
  products,
}: {
  mediaByProductId?: Record<string, ProductMedia[]>;
  products: Product[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("newest");
  const [kind, setKind] = useState("All");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = products.filter((product) => {
      const matchesCategory = category === "All" || product.category === category;
      const isDigital = product.category === "Digital Products" || product.tags?.some((tag) => tag.toLowerCase().includes("digital"));
      const requestOnly = isRequestOnlyProduct(product);
      const matchesKind =
        kind === "All" ||
        (kind === "Digital" ? isDigital : kind === "Requestable" ? requestOnly : !isDigital && !requestOnly);
      const matchesQuery =
        !normalizedQuery ||
        [product.name, product.short_description, product.category, product.tags?.join(" ")]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);

      return matchesCategory && matchesKind && matchesQuery;
    });

    return result.sort((a, b) => {
      if (sort === "featured") return Number(b.featured) - Number(a.featured);
      if (sort === "price-low") return (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER);
      if (sort === "price-high") return (b.price ?? -1) - (a.price ?? -1);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [category, kind, products, query, sort]);

  return (
    <div className="grid gap-8">
      <div className="grid gap-3 rounded-lg border border-white/10 bg-zinc-900/70 p-4 lg:grid-cols-[1fr_180px_220px_180px]">
        <label className="relative">
          <Search className="absolute left-3 top-3.5 text-zinc-500" size={18} />
          <input
            className="h-12 w-full rounded-md border border-white/10 bg-zinc-950 pl-10 pr-4 text-sm text-zinc-50 outline-none focus:border-amber-300"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            value={query}
          />
        </label>
        <select
          className="h-12 rounded-md border border-white/10 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:border-amber-300"
          onChange={(event) => setKind(event.target.value)}
          value={kind}
        >
          <option>All</option>
          <option>Digital</option>
          <option>Physical</option>
          <option>Requestable</option>
        </select>
        <select
          className="h-12 rounded-md border border-white/10 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:border-amber-300"
          onChange={(event) => setCategory(event.target.value)}
          value={category}
        >
          <option>All</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          className="h-12 rounded-md border border-white/10 bg-zinc-950 px-4 text-sm text-zinc-50 outline-none focus:border-amber-300"
          onChange={(event) => setSort(event.target.value)}
          value={sort}
        >
          <option value="newest">Newest</option>
          <option value="featured">Featured</option>
          <option value="price-low">Price low</option>
          <option value="price-high">Price high</option>
        </select>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Explainer icon={<Download size={18} />} title="Digital" text="Instant downloads are delivered through Etsy after checkout." />
        <Explainer icon={<Package size={18} />} title="3D printed" text="Physical products are made, packed, and shipped after purchase." />
        <Explainer icon={<Sparkles size={18} />} title="Requestable" text="Some source-model products need review and a custom Etsy checkout before printing." />
      </div>
      {filtered.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((product) => (
            <ProductCard key={product.id} media={mediaByProductId[product.id] || []} product={product} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-white/15 p-12 text-center text-zinc-400">
          No products match those filters.
        </div>
      )}
    </div>
  );
}

function Explainer({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/50 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-zinc-50">
        <span className="text-amber-200">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}
