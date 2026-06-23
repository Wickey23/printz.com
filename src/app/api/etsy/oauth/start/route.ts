import { NextResponse } from "next/server";
import { isApprovedAdmin } from "@/lib/auth";
import {
  etsyKeystring,
  etsyRedirectUri,
  etsyScopes,
  makeCodeChallenge,
  makeCodeVerifier,
  makeState,
  setEtsyOAuthStartCookies,
} from "@/lib/etsy-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!(await isApprovedAdmin(user?.email))) {
    return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "https://printzcom.vercel.app"));
  }

  const clientId = etsyKeystring();
  if (!clientId) {
    return NextResponse.redirect(new URL("/admin/etsy?etsy_error=missing_api_key", process.env.NEXT_PUBLIC_SITE_URL || "https://printzcom.vercel.app"));
  }

  const verifier = makeCodeVerifier();
  const state = makeState();
  await setEtsyOAuthStartCookies({ state, verifier });

  const url = new URL("https://www.etsy.com/oauth/connect");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", etsyRedirectUri());
  url.searchParams.set("scope", etsyScopes());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", makeCodeChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url);
}
