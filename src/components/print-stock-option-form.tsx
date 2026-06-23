"use client";

import { ActionForm } from "@/components/action-form";
import { createPrintStockOption } from "@/app/actions";

export function PrintStockOptionForm() {
  return (
    <ActionForm action={createPrintStockOption} className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
      {(state, pending) => (
        <div className="grid gap-4 lg:grid-cols-[160px_1fr_1fr_150px_110px_auto]">
          <label className="grid gap-2 text-sm font-bold text-zinc-200">
            Type
            <select className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100" name="option_type">
              <option value="material">Material</option>
              <option value="color">Color</option>
              <option value="finish">Finish</option>
            </select>
          </label>
          <Field label="Name" name="name" placeholder="Galaxy Purple" />
          <Field label="Value" name="value" placeholder="Galaxy Purple" />
          <Field label="Color picker" name="hex_color" placeholder="#7c3aed" type="color" />
          <Field label="Sort" name="sort_order" placeholder="10" type="number" />
          <button className="h-10 self-end rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:opacity-60" disabled={pending} type="submit">
            Add
          </button>
          {state.message ? (
            <p className={state.ok ? "lg:col-span-6 text-sm font-semibold text-emerald-300" : "lg:col-span-6 text-sm font-semibold text-amber-200"}>
              {state.message}
            </p>
          ) : null}
        </div>
      )}
    </ActionForm>
  );
}

function Field({ label, name, placeholder, type = "text" }: { label: string; name: string; placeholder?: string; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <input
        className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-amber-300/60"
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}
