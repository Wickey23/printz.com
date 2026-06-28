"use client";

import { RefreshCw } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { syncEtsyProducts } from "@/app/actions";

export function EtsySyncPanel() {
  return (
    <div className="min-w-72 rounded-lg border border-white/10 bg-zinc-900/70 p-3">
      <ActionForm action={syncEtsyProducts} className="grid gap-3">
        {(state, pending) => (
          <>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pending}
              type="submit"
            >
              <RefreshCw className={pending ? "animate-spin" : ""} size={16} />
              {pending ? "Syncing..." : "Sync Etsy listings"}
            </button>
            {state.message ? (
              <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>
                {state.message}
              </p>
            ) : (
              <p className="text-xs leading-5 text-zinc-500">
                Pulls Etsy listing edits, prices, descriptions, images, and active/inactive state into the website. Full state mirroring needs a connected Etsy OAuth token or ETSY_ACCESS_TOKEN.
              </p>
            )}
          </>
        )}
      </ActionForm>
    </div>
  );
}
