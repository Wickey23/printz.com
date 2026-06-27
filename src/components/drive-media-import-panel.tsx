"use client";

import { useActionState } from "react";
import { FolderInput, RefreshCw } from "lucide-react";
import { importProductDriveMedia, type ActionState } from "@/app/actions";
import type { Product } from "@/lib/types";

const initialState: ActionState = { ok: false, message: "" };

export function DriveMediaImportPanel({ imageCount = 0, product }: { imageCount?: number; product: Product }) {
  const [state, formAction, pending] = useActionState(importProductDriveMedia, initialState);
  const hasFolder = Boolean(product.drive_media_folder_url);

  return (
    <section className="grid gap-3 rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FolderInput className="text-amber-200" size={20} />
            <h2 className="text-lg font-black text-zinc-50">Drive media import</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Put product images or videos in a Google Drive folder, paste the folder URL in the product form, save, then import them into the site gallery.
          </p>
        </div>
        <span className="rounded bg-zinc-800 px-2 py-1 text-xs font-bold text-zinc-300">{imageCount} image{imageCount === 1 ? "" : "s"}</span>
      </div>

      <div className={hasFolder ? "rounded-md border border-emerald-400/20 bg-emerald-400/10 p-3" : "rounded-md border border-amber-300/20 bg-amber-300/10 p-3"}>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Connected Drive folder</p>
        {hasFolder ? (
          <a className="mt-1 block break-all text-sm font-semibold text-amber-100 underline" href={product.drive_media_folder_url || ""} rel="noreferrer" target="_blank">
            {product.drive_media_folder_url}
          </a>
        ) : (
          <p className="mt-1 text-sm text-amber-100">No folder saved yet. Add one in the product form below.</p>
        )}
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input name="product_id" type="hidden" value={product.id} />
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          <RefreshCw className={pending ? "animate-spin" : ""} size={16} />
          {pending ? "Importing..." : "Import Drive media"}
        </button>
        <p className="text-xs leading-5 text-zinc-400">The first image becomes the main image only when no main image is already set.</p>
      </form>

      {state.message ? (
        <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>{state.message}</p>
      ) : null}
    </section>
  );
}
