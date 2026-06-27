"use client";

import { useActionState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { autofillProductEtsyFields, type ActionState } from "@/app/actions";
import type { Product } from "@/lib/types";

const initialState: ActionState = { ok: false, message: "" };

export function AiEtsyAutofillPanel({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState(autofillProductEtsyFields, initialState);

  return (
    <section className="grid gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
      <div className="flex items-start gap-3">
        <Bot className="mt-1 shrink-0 text-emerald-200" size={22} />
        <div>
          <h2 className="text-lg font-black text-zinc-50">ChatGPT Etsy autofill</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Fill missing Etsy-readiness fields using this product plus Google Sheet research keywords, score, volume, competition, price notes, and launch notes.
          </p>
        </div>
      </div>

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input name="product_id" type="hidden" value={product.id} />
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md bg-emerald-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          <Sparkles className={pending ? "animate-pulse" : ""} size={16} />
          {pending ? "Writing..." : "Fill Etsy gaps"}
        </button>
        <p className="text-xs leading-5 text-zinc-400">Does not publish. Review generated fields before creating an Etsy draft.</p>
      </form>

      {state.message ? (
        <p className={state.ok ? "text-sm font-semibold text-emerald-200" : "text-sm font-semibold text-amber-200"}>{state.message}</p>
      ) : null}
    </section>
  );
}
