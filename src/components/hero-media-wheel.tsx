"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Play, Sparkles } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

type MediaItem = {
  type: "image" | "video";
  title: string;
  subtitle: string;
  href: string;
  src: string;
  price: number | null;
};

export function HeroMediaWheel({ products }: { products: Product[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userInteractingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const items = useMemo<MediaItem[]>(() => {
    const productItems = products
      .filter((product) => product.main_image_url)
      .map((product) => ({
        type: "image" as const,
        title: product.name,
        subtitle: product.category,
        href: `/products/${product.slug}`,
        src: product.main_image_url || "",
        price: product.price,
      }));

    return [
      ...productItems,
      {
        type: "video" as const,
        title: "Print process clips",
        subtitle: "Add workshop videos from admin",
        href: "/products",
        src: "",
        price: null,
      },
    ];
  }, [products]);

  useEffect(() => {
    if (items.length <= 1) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const interval = window.setInterval(() => {
      const element = scrollRef.current;
      if (!element || userInteractingRef.current) return;

      const cardWidth = Math.max(element.clientWidth * 0.82, 1);
      const currentIndex = Math.round(element.scrollLeft / cardWidth);
      const nextIndex = currentIndex >= items.length - 1 ? 0 : currentIndex + 1;

      element.scrollTo({
        left: nextIndex * cardWidth,
        behavior: "smooth",
      });
    }, 4200);

    return () => window.clearInterval(interval);
  }, [items.length]);

  function scrollByCard(direction: -1 | 1) {
    const element = scrollRef.current;
    if (!element) return;

    const cardWidth = element.clientWidth * 0.82;
    element.scrollBy({ left: direction * cardWidth, behavior: "smooth" });
  }

  return (
    <div className="relative lg:pl-4">
      <div
        aria-label="Featured product media carousel"
        className="hero-wheel flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
        onMouseEnter={() => {
          userInteractingRef.current = true;
        }}
        onMouseLeave={() => {
          userInteractingRef.current = false;
        }}
        onPointerDown={() => {
          userInteractingRef.current = true;
        }}
        onPointerUp={() => {
          userInteractingRef.current = false;
        }}
        onScroll={(event) => {
          const target = event.currentTarget;
          const width = Math.max(target.clientWidth * 0.82, 1);
          setActiveIndex(Math.min(items.length - 1, Math.max(0, Math.round(target.scrollLeft / width))));
        }}
        onWheel={(event) => {
          const element = scrollRef.current;
          if (!element || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          element.scrollLeft += event.deltaY;
        }}
        ref={scrollRef}
      >
        {items.map((item, index) => (
          <Link
            className="group relative min-w-[82%] snap-center overflow-hidden rounded-lg border border-white/10 bg-zinc-900 shadow-2xl transition hover:border-amber-300/40 sm:min-w-[74%] lg:min-w-[78%]"
            href={item.href}
            key={`${item.title}-${index}`}
          >
            <div className="aspect-[4/5]">
              {item.type === "image" ? (
                <img
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  src={item.src}
                />
              ) : (
                <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,rgba(252,211,77,0.22),transparent_32%),linear-gradient(135deg,#18181b,#09090b)]">
                  <div className="grid place-items-center gap-4 text-center">
                    <span className="grid size-16 place-items-center rounded-full bg-amber-300 text-zinc-950">
                      <Play fill="currentColor" size={26} />
                    </span>
                    <span className="max-w-48 text-sm font-semibold leading-6 text-zinc-300">
                      Upload product turntables, timelapses, or shop clips.
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent p-5 pt-24">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">
                    {item.subtitle}
                  </p>
                  <h2 className="mt-2 text-xl font-black text-zinc-50">{item.title}</h2>
                </div>
                <p className="shrink-0 rounded-md bg-zinc-50 px-3 py-1.5 text-xs font-black text-zinc-950">
                  {formatPrice(item.price)}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-4">
        <div className="flex gap-1.5">
          {items.map((item, index) => (
            <button
              aria-label={`Go to ${item.title}`}
              className={activeIndex === index ? "h-2 w-8 rounded-full bg-amber-300" : "h-2 w-2 rounded-full bg-white/25"}
              key={item.title}
              onClick={() => {
                const element = scrollRef.current;
                if (!element) return;
                element.scrollTo({ left: index * element.clientWidth * 0.82, behavior: "smooth" });
              }}
              type="button"
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            aria-label="Previous media"
            className="grid size-10 place-items-center rounded-md border border-white/10 text-zinc-200 transition hover:border-amber-300/40"
            onClick={() => scrollByCard(-1)}
            type="button"
          >
            <ArrowLeft size={17} />
          </button>
          <button
            aria-label="Next media"
            className="grid size-10 place-items-center rounded-md border border-white/10 text-zinc-200 transition hover:border-amber-300/40"
            onClick={() => scrollByCard(1)}
            type="button"
          >
            <ArrowRight size={17} />
          </button>
        </div>
      </div>

      <div className="pointer-events-none absolute -left-2 top-7 hidden rounded-md border border-amber-300/30 bg-zinc-950/90 px-3 py-2 text-xs font-bold text-amber-200 backdrop-blur lg:inline-flex">
        <Sparkles size={14} className="mr-2" /> Scroll the wheel
      </div>
    </div>
  );
}
