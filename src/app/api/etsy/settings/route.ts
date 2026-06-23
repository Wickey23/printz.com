import { NextResponse } from "next/server";
import { isApprovedAdmin } from "@/lib/auth";
import { discoverEtsyRuntimeIds } from "@/lib/etsy-discovery";
import { getSavedEtsyRuntimeSettings, getValidEtsyOAuthToken, setEtsyRuntimeSettings } from "@/lib/etsy-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, string>;
  const settings = {
    shopId: clean(body.shopId),
    taxonomyId: clean(body.taxonomyId),
    shippingProfileId: clean(body.shippingProfileId),
    readinessStateId: clean(body.readinessStateId),
  };

  if (!settings.shopId || !settings.taxonomyId) {
    return NextResponse.json({ ok: false, message: "Shop ID and default taxonomy ID are required." }, { status: 400 });
  }

  await setEtsyRuntimeSettings(settings);
  return NextResponse.json({ ok: true, message: "Saved Etsy IDs. The checklist and draft tools can use them now.", settings });
}

export async function PUT() {
  const user = await getCurrentUser();
  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const etsyToken = await getValidEtsyOAuthToken();
  if (!etsyToken?.access_token) {
    return NextResponse.json({ ok: false, message: "Connect Etsy first, then run auto-detect." }, { status: 400 });
  }

  try {
    const settings = await discoverEtsyRuntimeIds({
      accessToken: etsyToken.access_token,
      shopName: process.env.ETSY_SHOP_NAME || "printzbykhan",
    });
    const saved = await getSavedEtsyRuntimeSettings();
    const mergedSettings = {
      shopId: settings.shopId || saved.shopId,
      taxonomyId: settings.taxonomyId || saved.taxonomyId,
      shippingProfileId: settings.shippingProfileId || saved.shippingProfileId,
      readinessStateId: settings.readinessStateId || saved.readinessStateId,
    };
    await setEtsyRuntimeSettings(mergedSettings);

    return NextResponse.json({
      ok: true,
      message: settings.notes.length
        ? `Auto-detected what Etsy allowed. Notes: ${settings.notes.join(" ")}`
        : "Auto-detected and saved Etsy IDs.",
      settings: mergedSettings,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not auto-detect Etsy IDs." },
      { status: 400 },
    );
  }
}

async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function clean(value: unknown) {
  return String(value || "").trim();
}
