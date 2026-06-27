"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

type ProductGalleryItem = {
  media_type: "image" | "video";
  url: string;
};

export function ProductMediaCarousel({ items, productName }: { items: ProductGalleryItem[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const gallery = useMemo(() => items.filter((item) => item.url), [items]);
  const active = gallery[activeIndex] || gallery[0];

  function move(direction: -1 | 1) {
    if (!gallery.length) return;
    setActiveIndex((current) => (current + direction + gallery.length) % gallery.length);
  }

  if (!gallery.length) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center rounded-lg border border-white/10 bg-zinc-900 text-zinc-500">
        <Sparkles size={42} />
      </div>
    );
  }

  return (
    <section className="grid gap-3" aria-label={`${productName} media gallery`}>
      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950">
        <div className="grid aspect-[4/3] w-full place-items-center bg-zinc-950 sm:aspect-[5/4] lg:aspect-[4/3]">
          {active.media_type === "image" ? (
            <img
              alt={`${productName} preview ${activeIndex + 1}`}
              className="max-h-full max-w-full object-contain"
              src={active.url}
            />
          ) : (
            <video
              className="max-h-full max-w-full object-contain"
              controls
              src={active.url}
            />
          )}
        </div>

        {gallery.length > 1 ? (
          <>
            <button
              aria-label="Previous product media"
              className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-zinc-950/85 text-zinc-50 shadow-lg backdrop-blur transition hover:border-amber-300/70 hover:text-amber-200"
              onClick={() => move(-1)}
              type="button"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              aria-label="Next product media"
              className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-zinc-950/85 text-zinc-50 shadow-lg backdrop-blur transition hover:border-amber-300/70 hover:text-amber-200"
              onClick={() => move(1)}
              type="button"
            >
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 right-3 rounded-full border border-white/10 bg-zinc-950/85 px-3 py-1 text-xs font-bold text-zinc-200 backdrop-blur">
              {activeIndex + 1} / {gallery.length}
            </div>
          </>
        ) : null}
      </div>

      {gallery.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-2" aria-label="Product media thumbnails">
          {gallery.map((item, index) => (
            <button
              aria-label={`Show product media ${index + 1}`}
              aria-pressed={index === activeIndex}
              className={
                index === activeIndex
                  ? "grid aspect-square w-20 shrink-0 place-items-center overflow-hidden rounded-md border-2 border-amber-300 bg-zinc-950 sm:w-24"
                  : "grid aspect-square w-20 shrink-0 place-items-center overflow-hidden rounded-md border border-white/10 bg-zinc-950 transition hover:border-amber-300/50 sm:w-24"
              }
              key={`${item.url}-thumb-${index}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              {item.media_type === "image" ? (
                <img alt="" className="h-full w-full object-contain p-1" src={item.url} />
              ) : (
                <video className="h-full w-full object-contain p-1" muted src={item.url} />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
