"use server";

import type { ActionState } from "@/app/actions";
import { isApprovedAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { textFromForm } from "@/lib/utils";

const success = (message: string): ActionState => ({ ok: true, message });
const failure = (message: string): ActionState => ({ ok: false, message });

export async function requestAdminPasswordReset(_: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return failure("Supabase is not configured yet.");

  const email = textFromForm(formData, "email");
  if (!email) return failure("Email is required.");

  const genericMessage = "If that email is an approved admin account, a password reset link has been sent.";
  if (!(await isApprovedAdmin(email))) return success(genericMessage);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectTo = `${siteUrl.replace(/\/$/, "")}/auth/callback?next=/account`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) return failure(error.message);

  return success(genericMessage);
}
