import Link from "next/link";
import { ProductForm } from "@/components/product-form";
import { ProductImportPanel } from "@/components/product-import-panel";
import { requireAdmin } from "@/lib/auth";

export default async function NewProductPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  return (
    <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Add product</h1>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/imports">
          Mass import page
        </Link>
      </div>
      <div className="grid gap-6">
        <ProductImportPanel />
        <ProductForm />
      </div>
    </section>
  );
}
