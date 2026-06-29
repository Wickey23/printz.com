"use server";

import { headers } from "next/headers";
import type { ActionState } from "@/app/actions";
import { isApprovedAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { textFromForm } from "@/lib/utils";

const fallbackSiteUrl = "https://printzcom.vercel.app";

const success = (message: string): ActionState => ({ ok: true, message });
const failure = (message: string): ActionState => ({ ok: false, message });

export async function requestAdminPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const email = textFromForm(formData, "email");
  if (!email) return failure("Email is required.");

  const genericMessage = "If that email is an approved admin account, a password reset link has been sent.";
  if (!(await isApprovedAdmin(email))) return success(genericMessage);

  const siteUrl = await getSiteUrl();
  const redirectTo = `${siteUrl}/auth/callback?next=/account`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return failure(error.message);

  return success(genericMessage);
}

async function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl && !configuredUrl.includes("localhost")) return trimTrailingSlash(configuredUrl);

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") || headersList.get("host");
  if (!host || host.includes("localhost") || host.includes("127.0.0.1")) return fallbackSiteUrl;

  const protocol = headersList.get("x-forwarded-proto") || "https";
  return `${protocol}://${host}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}
