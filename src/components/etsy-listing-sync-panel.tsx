"use client";

import { useActionState } from "react";
import { ExternalLink, RefreshCw, UploadCloud } from "lucide-react";
import { syncProductToEtsyListing, type EtsyDraftState } from "@/app/actions";
import type { Product } from "@/lib/types";

const initialState: EtsyDraftState = { ok: false, message: "" };

export function EtsyListingSyncPanel({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState(syncProductToEtsyListing, initialState);

  return (
    <section className="grid gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
      <div>
        <h2 className="text-lg font-black text-zinc-50">Etsy listing sync</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          Push this website product to Etsy. Sync creates/updates a draft and uploads product images. Publish is explicit.
        </p>
        {product.etsy_listing_id ? (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Attached Etsy listing: {product.etsy_listing_id} ({product.etsy_state || "unknown"})</p>
        ) : (
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-100">No Etsy listing attached yet</p>
        )}
      </div>
      <form action={formAction} className="flex flex-wrap gap-3">
        <input name="product_id" type="hidden" value={product.id} />
        <button className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending} type="submit">
          <RefreshCw className={pending ? "animate-spin" : ""} size={16} />
          {product.etsy_listing_id ? "Sync Etsy draft" : "Create Etsy draft"}
        </button>
        <button className="inline-flex h-10 items-center gap-2 rounded-md border border-red-300/40 px-4 text-sm font-black text-red-100 disabled:opacity-60" disabled={pending} name="publish" type="submit" value="on">
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
