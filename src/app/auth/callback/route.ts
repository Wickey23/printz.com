import { NextResponse, type NextRequest } from "next/server";
import { getConfiguredSiteUrl, isLocalUrl } from "@/lib/site-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase?.auth.exchangeCodeForSession(code);
  }

  const redirectOrigin = isLocalUrl(requestUrl.origin) ? getConfiguredSiteUrl() : requestUrl.origin;
  return NextResponse.redirect(new URL(next, redirectOrigin));
}

function safeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}
