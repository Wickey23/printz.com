import Link from "next/link";
import { updateCustomPrintEtsyCheckout } from "@/app/actions";
import { requireAdmin } from "@/lib/auth";
import { getPrintRequestsForAdmin } from "@/lib/data";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AdminPrintRequestsPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  const requests = await getPrintRequestsForAdmin();
  const supabase = createSupabaseAdminClient();

  const signedUrls = new Map<string, string>();
  if (supabase) {
    for (const request of requests) {
      for (const path of [...request.file_urls, ...request.image_urls]) {
        const { data } = await supabase.storage.from("print-uploads").createSignedUrl(path, 60 * 60);
        if (data?.signedUrl) signedUrls.set(path, data.signedUrl);
      }
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Custom print requests</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Customer uploads, shipping details, payment status, and production status. Private file links expire after one hour.
          </p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
          Back to admin
        </Link>
      </div>

      <div className="grid gap-5">
        {requests.map((request) => (
          <article className="rounded-lg border border-white/10 bg-zinc-900/70 p-5" key={request.id}>
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-black text-zinc-50">{request.title}</h2>
                  <span className="rounded-md bg-amber-300/15 px-2 py-1 text-xs font-bold text-amber-100">{request.payment_status.replaceAll("_", " ")}</span>
                  <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold text-zinc-200">{request.production_status.replaceAll("_", " ")}</span>
                </div>
                <p className="mt-2 text-sm text-zinc-400">
                  {request.customer_email} · {new Date(request.created_at).toLocaleString()}
                </p>
                {request.notes ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{request.notes}</p> : null}

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Info label="Material" value={request.material} />
                  <Info label="Color" value={request.color} />
                  <Info label="Finish" value={request.finish} />
                  <Info label="Quantity" value={String(request.quantity)} />
                  <Info label="Infill" value={`${request.infill_percent}%`} />
                  <Info label="Estimate" value={request.estimate_cents ? `$${(request.estimate_cents / 100).toFixed(2)}` : "Needs slicing"} />
                  <Info label="Quoted price" value={request.quoted_cents ? `$${(request.quoted_cents / 100).toFixed(2)}` : "Not sent"} />
                </div>
              </div>

              <aside className="rounded-md border border-white/10 bg-zinc-950 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Ship to</p>
                <p className="mt-2 font-bold text-zinc-100">{request.shipping_name}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-400">{request.shipping_address}</p>
              </aside>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <FileList title="3D model files" paths={request.file_urls} names={request.file_names} signedUrls={signedUrls} />
              <FileList title="Reference media" paths={request.image_urls} signedUrls={signedUrls} />
            </div>

            <form action={updateCustomPrintEtsyCheckout} className="mt-5 grid gap-3 rounded-md border border-amber-300/20 bg-amber-300/10 p-4 lg:grid-cols-[1fr_160px_170px_170px_auto]">
              <input name="id" type="hidden" value={request.id} />
              <label className="grid gap-2 text-sm font-bold text-zinc-200">
                Etsy checkout link
                <input
                  className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-amber-300/60"
                  defaultValue={request.etsy_checkout_url || ""}
                  name="etsy_checkout_url"
                  placeholder="https://www.etsy.com/listing/..."
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-200">
                Quote
                <input
                  className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-amber-300/60"
                  defaultValue={request.quoted_cents ? (request.quoted_cents / 100).toFixed(2) : ""}
                  name="quoted_price"
                  placeholder="34.99"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-200">
                Payment
                <select className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100" defaultValue={request.payment_status} name="payment_status">
                  {["quote_pending", "checkout_pending", "paid", "canceled", "refunded"].map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-200">
                Production
                <select className="h-10 rounded-md border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-100" defaultValue={request.production_status} name="production_status">
                  {["new", "reviewing", "ready_to_print", "printing", "shipped", "completed", "rejected"].map((status) => (
                    <option key={status} value={status}>{status.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <button className="h-10 self-end rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950" type="submit">
                Save
              </button>
            </form>
          </article>
        ))}
        {!requests.length ? <p className="rounded-lg border border-white/10 bg-zinc-900/70 p-5 text-zinc-400">No custom print requests yet.</p> : null}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function FileList({
  title,
  paths,
  names,
  signedUrls,
}: {
  title: string;
  paths: string[];
  names?: string[];
  signedUrls: Map<string, string>;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <div className="mt-3 grid gap-2">
        {paths.map((path, index) => {
          const label = names?.[index] || path.split("/").pop() || path;
          const href = signedUrls.get(path);
          return href ? (
            <a className="truncate text-sm font-bold text-amber-200 underline" href={href} key={path}>
              {label}
            </a>
          ) : (
            <p className="truncate text-sm text-zinc-400" key={path}>{label}</p>
          );
        })}
        {!paths.length ? <p className="text-sm text-zinc-500">None uploaded.</p> : null}
      </div>
    </div>
  );
}
