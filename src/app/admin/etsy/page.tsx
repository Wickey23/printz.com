import Link from "next/link";
import { AlertTriangle, Bot, CheckCircle2, RefreshCw } from "lucide-react";
import { EtsySettingsPanel } from "@/components/etsy-settings-panel";
import { EtsySyncPanel } from "@/components/etsy-sync-panel";
import { requireAdmin } from "@/lib/auth";
import { etsyRedirectUri, getEffectiveEtsyRuntimeSettings, getEtsyOAuthToken } from "@/lib/etsy-auth";

export default async function EtsyControlCenterPage() {
  const auth = await requireAdmin();
  if (!auth.approved) return null;

  const [etsyToken, etsySettings] = await Promise.all([
    getEtsyOAuthToken().catch(() => null),
    getEffectiveEtsyRuntimeSettings().catch(() => ({
      shopId: "",
      taxonomyId: "",
      shippingProfileId: "",
      readinessStateId: "",
    })),
  ]);
  const hasOAuthToken = Boolean(etsyToken?.access_token);
  const setup = etsySetupItems(hasOAuthToken, etsySettings);

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
          <h1 className="mt-2 text-4xl font-black text-zinc-50">Etsy Control Center</h1>
          <p className="mt-4 max-w-3xl leading-7 text-zinc-400">
            Manage the Etsy connection, sync active Etsy listings into the website, and check what is still needed before draft creation.
          </p>
        </div>
        <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin">
          Back to admin
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-white/10 bg-zinc-900/70 p-5">
          <div className="flex items-center gap-2">
            <RefreshCw className="text-amber-200" size={20} />
            <h2 className="text-xl font-black text-zinc-50">Connection checklist</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {setup.map((item) => (
              <div className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-zinc-950 px-3 py-2" key={item.key}>
                <span className="text-sm font-semibold text-zinc-200">{item.label}</span>
                <span className={item.ok ? "inline-flex items-center gap-1 text-xs font-bold text-emerald-300" : "inline-flex items-center gap-1 text-xs font-bold text-amber-200"}>
                  {item.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {item.ok ? "Configured" : "Missing"}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <a className="inline-flex h-10 items-center rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950" href="/api/etsy/oauth/start">
              {hasOAuthToken ? "Reconnect Etsy" : "Connect Etsy"}
            </a>
            <Link className="inline-flex h-10 items-center rounded-md border border-white/10 px-4 text-sm font-bold text-zinc-200" href="/admin/products/new">
              Create site product
            </Link>
          </div>

          <p className="mt-5 text-sm leading-6 text-zinc-400">
            Etsy redirect URI to register exactly:
            <span className="mt-1 block break-all font-mono text-zinc-200">{etsyRedirectUri()}</span>
          </p>

          <EtsySettingsPanel settings={etsySettings} />

          <div className="mt-5 rounded-md border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-zinc-200">
            <p className="font-black text-amber-100">Draft creation status</p>
            <p className="mt-2">
              OAuth is {hasOAuthToken ? "connected" : "not connected"}. Draft creation also needs shop ID, taxonomy ID, shipping profile ID, and readiness state ID configured in the environment or saved settings.
            </p>
          </div>
        </section>

        <aside className="grid h-fit gap-5">
          <EtsySyncPanel />
          <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-5">
            <div className="flex items-center gap-2">
              <Bot className="text-amber-100" size={20} />
              <h2 className="text-xl font-black text-zinc-50">Employee agent prompts</h2>
            </div>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-zinc-200">
              <Prompt text="Audit all current listings for selling rights and give applyable edits to mark unsafe products inactive." />
              <Prompt text="Pick 3 products from the catalog, improve their Etsy SEO, and give me applyable edits." />
              <Prompt text="Research 3D print and digital product opportunities for the shop." />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Prompt({ text }: { text: string }) {
  return <p className="rounded-md border border-white/10 bg-zinc-950 px-3 py-2">{text}</p>;
}

function etsySetupItems(hasOAuthToken: boolean, settings: { shopId: string; taxonomyId: string; shippingProfileId: string; readinessStateId: string }) {
  return [
    { key: "ETSY_API_KEY", label: "API keystring + shared secret", ok: Boolean(process.env.ETSY_API_KEY) },
    { key: "ETSY_ACCESS_TOKEN", label: "Connected Etsy OAuth with listings_w", ok: Boolean(process.env.ETSY_ACCESS_TOKEN) || hasOAuthToken },
    { key: "ETSY_SHOP_ID", label: "Shop ID", ok: Boolean(settings.shopId) },
    { key: "ETSY_DEFAULT_TAXONOMY_ID", label: "Default taxonomy ID", ok: Boolean(settings.taxonomyId) },
    { key: "ETSY_SHIPPING_PROFILE_ID", label: "Shipping profile ID for physical items", ok: Boolean(settings.shippingProfileId) },
    { key: "ETSY_READINESS_STATE_ID", label: "Readiness state ID for physical items", ok: Boolean(settings.readinessStateId) },
  ];
}

