"use client";

import { useActionState } from "react";
import { Bot, Rocket, Sparkles } from "lucide-react";
import { automateProductListingDraft, autofillProductEtsyFields, type ActionState } from "@/app/actions";
import type { Product } from "@/lib/types";

const initialState: ActionState = { ok: false, message: "" };

export function AiEtsyAutofillPanel({ product }: { product: Product }) {
  const [state, formAction, pending] = useActionState(autofillProductEtsyFields, initialState);
  const [automationState, automationAction, automationPending] = useActionState(automateProductListingDraft, initialState);

  return (
    <section className="grid gap-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
      <div className="flex items-start gap-3">
        <Bot className="mt-1 shrink-0 text-emerald-200" size={22} />
        <div>
          <h2 className="text-lg font-black text-zinc-50">Etsy autofill</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-300">
            Fill missing Etsy-readiness fields using this product plus Google Sheet research. Add the source URL and images when you have them, then let AI finish the listing copy and draft prep.
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
        <p className="text-xs leading-5 text-zinc-400">Does not publish. Review filled fields before creating an Etsy draft.</p>
      </form>

      {state.message ? (
        <p className={state.ok ? "text-sm font-semibold text-emerald-200" : "text-sm font-semibold text-amber-200"}>{state.message}</p>
      ) : null}

      <form action={automationAction} className="flex flex-wrap items-center gap-3 border-t border-emerald-300/20 pt-3">
        <input name="product_id" type="hidden" value={product.id} />
        <button
          className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300/40 px-4 text-sm font-black text-emerald-100 disabled:opacity-60"
          disabled={automationPending}
          type="submit"
        >
          <Rocket className={automationPending ? "animate-pulse" : ""} size={16} />
          {automationPending ? "Automating..." : "Use AI + create Etsy draft"}
        </button>
        <p className="text-xs leading-5 text-zinc-400">
          Runs AI fill, checks readiness, then creates or syncs an Etsy draft if source, rights, price, and required fields are ready.
        </p>
      </form>

      {automationState.message ? (
        <p className={automationState.ok ? "text-sm font-semibold text-emerald-200" : "text-sm font-semibold text-amber-200"}>{automationState.message}</p>
      ) : null}
    </section>
  );
}
