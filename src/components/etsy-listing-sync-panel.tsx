"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, ListChecks, RefreshCw, UploadCloud } from "lucide-react";
import { syncProductToEtsyListing, type EtsyDraftState } from "@/app/actions";
import { getEtsyReadiness } from "@/lib/etsy-readiness";
import type { Product } from "@/lib/types";

const initialState: EtsyDraftState = { ok: false, message: "" };

export function EtsyListingSyncPanel({ imageCount = 0, product }: { imageCount?: number; product: Product }) {
  const [state, formAction, pending] = useActionState(syncProductToEtsyListing, initialState);
  const readiness = getEtsyReadiness(product, { imageCount: imageCount || (product.main_image_url ? 1 : 0) });
  const visibleItems = readiness.items.filter((item) => !item.ok || item.level === "required");

  return (
    <section className="grid gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-zinc-50">Etsy listing sync</h2>
          <span className={readiness.readyToPublish ? "rounded bg-emerald-400/15 px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-200" : readiness.readyToDraft ? "rounded bg-amber-300/15 px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-amber-100" : "rounded bg-red-400/15 px-2 py-1 text-xs font-black uppercase tracking-[0.14em] text-red-200"}>
            {readiness.readyToPublish ? "Ready to publish" : readiness.readyToDraft ? "Draft ready" : "Needs work"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Push this website product to Etsy. Sync creates/updates a draft and uploads product images. Publish is explicit.
        </p>
        {product.etsy_listing_id ? (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Attached Etsy listing: {product.etsy_listing_id} ({product.etsy_state || "unknown"})</p>
        ) : (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-100">No Etsy listing attached yet</p>
        )}
      </div>
      <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ListChecks className="text-amber-200" size={18} />
            <p className="text-sm font-black text-zinc-100">Etsy readiness</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">{readiness.productType}</p>
        </div>
        <div className="mt-3 grid gap-2">
          {visibleItems.map((item) => (
            <div className="grid gap-1 rounded border border-white/10 bg-zinc-900 p-3" key={item.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-zinc-100">{item.label}</span>
                <span className={item.ok ? "inline-flex items-center gap-1 text-xs font-bold text-emerald-300" : item.level === "required" ? "inline-flex items-center gap-1 text-xs font-bold text-red-200" : "inline-flex items-center gap-1 text-xs font-bold text-amber-200"}>
                  {item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {item.ok ? "Ready" : item.level === "required" ? "Required" : "Recommended"}
                </span>
              </div>
              <p className="text-xs leading-5 text-zinc-400">{item.detail}</p>
            </div>
          ))}
        </div>
        {!readiness.readyToPublish ? (
          <p className="mt-3 text-xs leading-5 text-zinc-400">
            Publish unlocks after required fields, recommended Etsy details, and at least 5 product images are ready.
          </p>
        ) : null}
      </div>
      <form action={formAction} className="flex flex-wrap gap-3">
        <input name="product_id" type="hidden" value={product.id} />
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending || !readiness.readyToDraft} type="submit">
          <RefreshCw className={pending ? "animate-spin" : ""} size={16} />
          {product.etsy_listing_id ? "Sync Etsy draft" : "Create Etsy draft"}
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-red-300/40 px-4 text-sm font-black text-red-100 disabled:opacity-60" disabled={pending || !readiness.readyToPublish} name="publish" type="submit" value="on">
          <UploadCloud size={16} />
          Publish to Etsy
        </button>
      </form>
      <p className="text-xs leading-5 text-zinc-400">
        Publishing can make a real public Etsy listing. Use only after rights, price, photos, shipping, and variations are reviewed.
      </p>
      {state.message ? (
        <div className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>
          <p>{state.message}</p>
          {state.listingUrl ? (
            <a className="mt-1 inline-flex items-center gap-1 text-amber-100 underline" href={state.listingUrl} rel="noreferrer" target="_blank">
              Open Etsy listing <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
