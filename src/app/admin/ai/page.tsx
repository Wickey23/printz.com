import Link from "next/link";
import { getBulkOpportunitySettings } from "@/app/actions";
import { AiListingGenerator } from "@/components/ai-listing-generator";
import { requireAdmin } from "@/lib/auth";

export default async function AdminAiPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;
  const bulkOpportunitySettings = await getBulkOpportunitySettings();

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">AI workspace</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            Use OpenAI to research Etsy opportunities, save market reports, and turn product ideas or source links into editable listings.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/pricing">
            Price calculator
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
            Back to admin
          </Link>
        </div>
      </div>
      <AiListingGenerator bulkOpportunitySettings={bulkOpportunitySettings} />
    </section>
  );
}
