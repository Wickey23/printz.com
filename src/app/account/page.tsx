import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, PackageCheck, UserRound } from "lucide-react";
import { signOutCustomer } from "@/app/actions";
import { AccountForm } from "@/components/account-form";
import { getPrintRequestsForUser } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Account | PRINTZ By Khan",
  description: "Manage your PRINTZ account and custom 3D print requests.",
};

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/custom-print");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) redirect("/custom-print");

  const requests = await getPrintRequestsForUser();
  const displayName = typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null;
  const avatarUrl = typeof user.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
  const phone = typeof user.user_metadata?.phone === "string" ? user.user_metadata.phone : null;
  const defaultShippingAddress = typeof user.user_metadata?.default_shipping_address === "string" ? user.user_metadata.default_shipping_address : null;
  const emailNotifications = typeof user.user_metadata?.email_notifications === "boolean" ? user.user_metadata.email_notifications : true;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Account</p>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-zinc-50">Manage your account</h1>
          <p className="mt-4 max-w-2xl text-zinc-400">
            Update your profile, saved shipping details, custom print uploads, quotes, Etsy payment links, and production status.
          </p>
        </div>
        <form action={signOutCustomer}>
          <button className="h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" type="submit">
            Sign out
          </button>
        </form>
      </div>

      <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
        <AccountForm
          avatarUrl={avatarUrl}
          defaultShippingAddress={defaultShippingAddress}
          displayName={displayName}
          email={user.email}
          emailNotifications={emailNotifications}
          phone={phone}
        />

        <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black text-zinc-50">Custom print requests</h2>
              <p className="mt-1 text-sm text-zinc-400">Your uploads and Etsy checkout links.</p>
            </div>
            <Link className="hidden h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 sm:inline-flex" href="/custom-print">
              New request
            </Link>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-md border border-white/10 bg-zinc-950 p-4">
              <h3 className="text-sm font-black text-zinc-50">Purchase history</h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Custom print requests are saved here now. Etsy purchase history will appear here after Etsy OAuth/order sync is connected and Etsy can match orders to this account email.
              </p>
            </div>
            {requests.map((request) => (
              <article className="rounded-md border border-white/10 bg-zinc-950 p-4" key={request.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-zinc-50">{request.title}</p>
                    {request.model_source_url ? (
                      <a className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-amber-200 underline" href={request.model_source_url} rel="noreferrer" target="_blank">
                        {request.model_source_platform || "Model source"} <ExternalLink size={13} />
                      </a>
                    ) : null}
                    <p className="mt-1 text-sm text-zinc-400">
                      {new Date(request.created_at).toLocaleDateString()} · {request.file_names.length} file(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-md bg-amber-300/15 px-2 py-1 text-amber-100">{request.payment_status.replaceAll("_", " ")}</span>
                    <span className="rounded-md bg-white/10 px-2 py-1 text-zinc-200">{request.production_status.replaceAll("_", " ")}</span>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Info label="Material" value={request.material} />
                  <Info label="Color" value={request.color} />
                  <Info label="Quantity" value={String(request.quantity)} />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {request.quoted_cents ? <p className="text-sm font-black text-zinc-100">Quote: ${(request.quoted_cents / 100).toFixed(2)}</p> : null}
                  {request.etsy_checkout_url ? (
                    <a className="inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950" href={request.etsy_checkout_url} rel="noreferrer" target="_blank">
                      Pay on Etsy
                    </a>
                  ) : (
                    <p className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-400">
                      <PackageCheck size={16} /> Waiting for review and Etsy checkout link
                    </p>
                  )}
                </div>
              </article>
            ))}
            {!requests.length ? (
              <div className="grid place-items-center rounded-md border border-dashed border-white/10 p-8 text-center">
                <UserRound className="text-zinc-500" size={28} />
                <p className="mt-3 text-sm leading-6 text-zinc-400">No custom print requests yet.</p>
                <Link className="mt-4 inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950" href="/custom-print">
                  Upload a file
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
