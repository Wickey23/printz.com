import { redirect } from "next/navigation";
import { getAllowedAdminEmails, isSupabaseConfigured } from "@/lib/config";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function isApprovedAdmin(email: string | undefined | null) {
  if (!email) return false;

  const normalized = email.toLowerCase();
  const allowedEmails = getAllowedAdminEmails();
  if (allowedEmails.includes(normalized)) return true;

  const adminSupabase = createSupabaseAdminClient();
  if (!adminSupabase || !isSupabaseConfigured()) return false;

  const { data } = await adminSupabase
    .from("admin_users")
    .select("email")
    .eq("email", normalized)
    .eq("active", true)
    .maybeSingle();

  return Boolean(data);
}

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  const approved = await isApprovedAdmin(user.email);
  if (!approved) {
    return { user, approved: false };
  }

  return { user, approved: true };
}
