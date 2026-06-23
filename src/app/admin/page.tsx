import Link from "next/link";
import { deleteProduct, deleteSuggestion, signOutAdmin, updateSuggestionStatus } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getAllProductsForAdmin, getSuggestionsForAdmin } from "@/lib/data";
import { formatPrice } from "@/lib/utils";

export default async function AdminPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return <AccessDenied email={auth.user.email || ""} />;

  const [products, suggestions] = await Promise.all([getAllProductsForAdmin(), getSuggestionsForAdmin()]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Dashboard</h1>
        </div>
        <div className="flex gap-3">
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/ai">
            AI listing
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/etsy">
            Etsy control
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/trends">
            Trend reports
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/pricing">
            Pricing
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/print-requests">
            Print requests
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/print-options">
            Stock options
          </Link>
          <Link className="inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-bold text-zinc-950" href="/admin/products/new">
            Add product
          </Link>
          <form action={signOutAdmin}>
            <button className="h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" type="submit">
              Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-8">
        <section className="rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Products</h2>
          </div>
          <div className="divide-y divide-white/10">
            {products.map((product) => (
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={product.id}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-zinc-50">{product.name}</h3>
                    <span className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300">{product.category}</span>
                    {!product.active ? <span className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-200">Inactive</span> : null}
                    {product.featured ? <span className="rounded bg-amber-300/15 px-2 py-1 text-xs text-amber-200">Featured</span> : null}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{product.short_description}</p>
                  <p className="mt-2 text-sm font-semibold text-zinc-200">{formatPrice(product.price)}</p>
                  {product.source_url ? (
                    <a className="mt-2 inline-flex text-sm font-bold text-amber-200" href={product.source_url} rel="noreferrer" target="_blank">
                      Source model listing
                    </a>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <Link className="text-sm font-bold text-amber-200" href={`/admin/products/${product.id}`}>
                    Edit
                  </Link>
                  <form action={deleteProduct}>
                    <input name="id" type="hidden" value={product.id} />
                    <button className="text-sm font-bold text-red-300" type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {!products.length ? <p className="p-5 text-zinc-400">No products yet.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-zinc-900/70">
          <div className="border-b border-white/10 p-5">
            <h2 className="text-xl font-bold">Suggestions</h2>
          </div>
          <div className="divide-y divide-white/10">
            {suggestions.map((suggestion) => (
              <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto]" key={suggestion.id}>
                <div>
                  <h3 className="font-bold text-zinc-50">{suggestion.title}</h3>
                  <p className="mt-1 text-sm text-zinc-400">
                    {suggestion.name} · {suggestion.email} · {new Date(suggestion.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">{suggestion.description}</p>
                </div>
                <div className="grid gap-3">
                  <form action={updateSuggestionStatus} className="flex gap-2">
                    <input name="id" type="hidden" value={suggestion.id} />
                    <select className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm" defaultValue={suggestion.status} name="status">
                      {["New", "Reviewing", "In Progress", "Made", "Rejected"].map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <button className="h-10 rounded-md bg-zinc-50 px-3 text-sm font-bold text-zinc-950" type="submit">
                      Save
                    </button>
                  </form>
                  <form action={deleteSuggestion}>
                    <input name="id" type="hidden" value={suggestion.id} />
                    <button className="text-sm font-bold text-red-300" type="submit">
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
            {!suggestions.length ? <p className="p-5 text-zinc-400">No suggestions yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function AccessDenied({ email }: { email: string }) {
  return (
    <section className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-4xl font-black text-zinc-50">Access denied</h1>
      <p className="mt-4 text-zinc-400">{email} is signed in, but is not in the approved admin list.</p>
    </section>
  );
}
