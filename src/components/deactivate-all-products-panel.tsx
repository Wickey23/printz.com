"use client";

import { PowerOff } from "lucide-react";
import { deactivateAllProducts } from "@/app/actions";
import { ActionForm } from "@/components/action-form";

export function DeactivateAllProductsPanel() {
  return (
    <section className="rounded-lg border border-red-300/20 bg-red-500/10 p-5">
      <h2 className="text-xl font-black text-zinc-50">Product visibility reset</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        Use this before the first clean import. It marks every existing product inactive and unfeatured without deleting anything.
      </p>
      <ActionForm action={deactivateAllProducts} className="mt-4 grid gap-2">
        {(state, pending) => (
          <>
            <button className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-red-300/40 px-4 text-sm font-black text-red-100 disabled:opacity-60" disabled={pending} type="submit">
              <PowerOff size={16} />
              {pending ? "Updating..." : "Set all products inactive"}
            </button>
            {state.message ? <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>{state.message}</p> : null}
          </>
        )}
      </ActionForm>
    </section>
  );
}
