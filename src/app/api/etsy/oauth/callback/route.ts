import { NextRequest, NextResponse } from "next/server";
import { isApprovedAdmin } from "@/lib/auth";
import {
  clearEtsyOAuthStartCookies,
  etsyKeystring,
  etsyRedirectUri,
  getEtsyOAuthStartCookies,
  setEtsyOAuthToken,
} from "@/lib/etsy-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://printzcom.vercel.app";
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.redirect(new URL("/admin/login", siteUrl));
  }

  const error = request.nextUrl.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/admin/etsy?etsy_error=${encodeURIComponent(error)}`, siteUrl));
  }

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state") || "";
  const saved = await getEtsyOAuthStartCookies();
  await clearEtsyOAuthStartCookies();

  if (!code || !saved.state || state !== saved.state || !saved.verifier) {
    return NextResponse.redirect(new URL("/admin/etsy?etsy_error=invalid_oauth_state", siteUrl));
  }

  const body = new URLSearchParams();
  body.set("grant_type", "authorization_code");
  body.set("client_id", etsyKeystring());
  body.set("redirect_uri", etsyRedirectUri());
  body.set("code", code);
  body.set("code_verifier", saved.verifier);

  const response = await fetch("https://api.etsy.com/v3/public/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.error || "token_exchange_failed";
    return NextResponse.redirect(new URL(`/admin/etsy?etsy_error=${encodeURIComponent(message)}`, siteUrl));
  }

  await setEtsyOAuthToken({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: Date.now() + (payload.expires_in || 3600) * 1000,
  });

  return NextResponse.redirect(new URL("/admin/etsy?etsy_connected=1", siteUrl));
}
