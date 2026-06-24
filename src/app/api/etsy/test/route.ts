import { NextResponse } from "next/server";
import { isApprovedAdmin } from "@/lib/auth";
import { getEffectiveEtsyRuntimeSettings, getValidEtsyOAuthToken } from "@/lib/etsy-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.json({ ok: false, message: "Unauthorized." }, { status: 401 });
  }

  const [etsyToken, settings] = await Promise.all([getValidEtsyOAuthToken(), getEffectiveEtsyRuntimeSettings()]);
  if (!etsyToken?.access_token) {
    return NextResponse.json({ ok: false, message: "Connect Etsy first, then test the connection." }, { status: 400 });
  }

  const shopId = settings.shopId;
  if (!shopId) {
    return NextResponse.json({ ok: false, message: "Shop ID is missing. Save or auto-detect Etsy IDs first." }, { status: 400 });
  }

  try {
    const [me, shippingProfiles, readinessStates] = await Promise.all([
      etsyJson<{ user_id?: number; shop_id?: number }>(new URL("https://api.etsy.com/v3/application/users/me"), etsyToken.access_token),
      etsyJson<{ results?: Array<{ shipping_profile_id?: number; title?: string }> }>(
        new URL(`https://api.etsy.com/v3/application/shops/${shopId}/shipping-profiles`),
        etsyToken.access_token,
      ),
      etsyJson<{ results?: Array<{ readiness_state_id?: number; readiness_state?: string; name?: string }> }>(
        new URL(`https://api.etsy.com/v3/application/shops/${shopId}/readiness-state-definitions`),
        etsyToken.access_token,
      ),
    ]);

    return NextResponse.json({
      ok: true,
      message: "Etsy connection is working.",
      settings,
      me,
      shippingProfiles: (shippingProfiles.results || []).map((profile) => ({
        id: String(profile.shipping_profile_id || ""),
        title: profile.title || "",
      })),
      readinessStates: (readinessStates.results || []).map((state) => ({
        id: String(state.readiness_state_id || ""),
        title: state.readiness_state || state.name || "",
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Could not test Etsy connection." },
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

async function etsyJson<T>(url: URL, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-api-key": process.env.ETSY_API_KEY || "",
    },
    next: { revalidate: 0 },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Etsy API ${url.pathname} failed with ${response.status}: ${text.slice(0, 220)}`);
  }
  return JSON.parse(text) as T;
}
