import Link from "next/link";
import { PriceCalculator } from "@/components/price-calculator";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPricingPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Price calculator</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            Calculate Etsy-ready prices using print time, filament, handling, fees, failure buffer, and competitor pricing.
          </p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
          Back to admin
        </Link>
      </div>

      <PriceCalculator />
    </section>
  );
}
