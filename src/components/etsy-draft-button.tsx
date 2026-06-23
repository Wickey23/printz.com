"use client";

import { useActionState } from "react";
import { ExternalLink, FilePlus2 } from "lucide-react";
import { createEtsyDraftListing, type EtsyDraftState } from "@/app/actions";

const initialState: EtsyDraftState = {
  ok: false,
  message: "",
};

type Props = {
  productId: string;
  disabled?: boolean;
};

export function EtsyDraftButton({ productId, disabled }: Props) {
  const [state, formAction, pending] = useActionState(createEtsyDraftListing, initialState);

  return (
    <form action={formAction} className="grid gap-2">
      <input name="product_id" type="hidden" value={productId} />
      <button
        className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-amber-300/40 px-4 text-sm font-bold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled || pending}
        type="submit"
      >
        <FilePlus2 size={16} />
        {pending ? "Creating draft..." : "Make Etsy draft"}
      </button>
      {state.message ? (
        <div className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-amber-200"}>
          <p>{state.message}</p>
          {state.listingUrl ? (
            <a className="mt-1 inline-flex items-center gap-1 text-amber-200 underline" href={state.listingUrl} rel="noreferrer" target="_blank">
              Open Etsy listing <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
