import { Box, CreditCard, Truck } from "lucide-react";
import type React from "react";
import { CustomPrintPortal } from "@/components/custom-print-portal";
import { getPrintableModels, getPrintRequestsForUser, getPrintStockOptions } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Custom 3D Printing | PRINTZ By Khan",
  description: "Find or upload 3D model files, request a print, and pay before production through PRINTZ By Khan.",
};

type Props = {
  searchParams: Promise<{
    model_source_platform?: string;
    model_source_url?: string;
    notes?: string;
    title?: string;
  }>;
};

export default async function CustomPrintPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const [printableModels, requests, stockOptions] = await Promise.all([
    getPrintableModels(),
    user ? getPrintRequestsForUser() : [],
    getPrintStockOptions({ activeOnly: true }),
  ]);
  const displayName = user && typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "";
  const defaultShippingAddress = user && typeof user.user_metadata?.default_shipping_address === "string" ? user.user_metadata.default_shipping_address : "";

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Print your file</p>
          <h1 className="mt-3 text-5xl font-black tracking-tight text-zinc-50 sm:text-6xl">Find. Request. Pay on Etsy.</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-300">
            Create an account, search model libraries or upload your own files, and add print specs. We review each model, create a custom Etsy checkout listing, and print after payment.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Step icon={<Box size={18} />} title="Find or upload" text="Search model libraries or upload STL, 3MF, OBJ, STEP, ZIP, and more." />
          <Step icon={<CreditCard size={18} />} title="Pay on Etsy" text="A custom Etsy checkout link appears after review." />
          <Step icon={<Truck size={18} />} title="We ship it" text="Production starts after review and payment." />
        </div>
      </div>

      <div className="mt-10">
        <CustomPrintPortal
          defaultShippingAddress={defaultShippingAddress}
          defaultShippingName={displayName}
          initialModelSourcePlatform={cleanParam(params.model_source_platform)}
          initialModelSourceUrl={cleanParam(params.model_source_url)}
          initialNotes={cleanParam(params.notes)}
          initialTitle={cleanParam(params.title)}
          printableModels={printableModels}
          requests={requests}
          signedIn={Boolean(user)}
          stockOptions={stockOptions}
        />
      </div>
    </section>
  );
}

function cleanParam(value?: string) {
  return typeof value === "string" ? value.slice(0, 2000) : "";
}

function Step({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/70 p-4">
      <div className="grid size-9 place-items-center rounded-md bg-amber-300 text-zinc-950">{icon}</div>
      <p className="mt-4 font-black text-zinc-50">{title}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}
