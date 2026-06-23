import Link from "next/link";
import { deletePrintStockOption, updatePrintStockOption } from "@/app/actions";
import { PrintStockOptionForm } from "@/components/print-stock-option-form";
import { requireAdmin } from "@/lib/auth";
import { getPrintStockOptions } from "@/lib/data";
import type { PrintStockOption } from "@/lib/types";

const labels: Record<PrintStockOption["option_type"], string> = {
  material: "Materials",
  color: "Colors",
  finish: "Finishes",
};

export default async function AdminPrintOptionsPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  const options = await getPrintStockOptions();

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Print stock options</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">Manage the materials, colors, and finishes customers can select for custom print uploads.</p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
          Back to admin
        </Link>
      </div>

      <PrintStockOptionForm />

      <div className="mt-8 grid gap-6">
        {(["material", "color", "finish"] as const).map((type) => (
          <section className="rounded-lg border border-white/10 bg-zinc-900/70" key={type}>
            <div className="border-b border-white/10 p-5">
              <h2 className="text-xl font-black text-zinc-50">{labels[type]}</h2>
            </div>
            <div className="divide-y divide-white/10">
              {options.filter((option) => option.option_type === type).map((option) => (
                <form action={updatePrintStockOption} className="grid gap-3 p-5 lg:grid-cols-[90px_1fr_1fr_150px_100px_110px_auto_auto]" key={option.id}>
                  <input name="id" type="hidden" value={option.id} />
                  <input name="option_type" type="hidden" value={option.option_type} />
                  <div className="flex items-end">
                    {option.option_type === "color" ? (
                      <span className="size-10 rounded-md border border-white/20" style={{ backgroundColor: option.hex_color || option.value }} />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-md bg-amber-300/15 text-xs font-black text-amber-100">{option.option_type.slice(0, 3).toUpperCase()}</span>
                    )}
                  </div>
                  <Field defaultValue={option.name} label="Name" name="name" />
                  <Field defaultValue={option.value} label="Value" name="value" />
                  <Field defaultValue={option.hex_color || "#facc15"} label={option.option_type === "color" ? "Color" : "Hex"} name="hex_color" type={option.option_type === "color" ? "color" : "text"} />
                  <Field defaultValue={String(option.sort_order)} label="Sort" name="sort_order" type="number" />
                  <label className="flex items-end gap-2 pb-2 text-sm font-bold text-zinc-200">
                    <input className="size-4 accent-amber-300" defaultChecked={option.active} name="active" type="checkbox" />
                    Active
                  </label>
                  <button className="h-10 self-end rounded-md bg-zinc-50 px-4 text-sm font-black text-zinc-950" type="submit">
                    Save
                  </button>
                  <button className="h-10 self-end rounded-md border border-red-300/30 px-4 text-sm font-black text-red-200" formAction={deletePrintStockOption} type="submit">
                    Delete
                  </button>
                </form>
              ))}
              {!options.some((option) => option.option_type === type) ? <p className="p-5 text-zinc-400">No {labels[type].toLowerCase()} yet.</p> : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function Field({ defaultValue, label, name, type = "text" }: { defaultValue: string; label: string; name: string; type?: string }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-200">
      {label}
      <input
        className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-amber-300/60"
        defaultValue={defaultValue}
        name={name}
        type={type}
      />
    </label>
  );
}
