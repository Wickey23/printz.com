import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin-login-form";

export const metadata: Metadata = {
  title: "Admin Login",
};

export default function AdminLoginPage() {
  return (
    <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">Admin</p>
        <h1 className="mt-3 text-4xl font-black text-zinc-50">Sign in</h1>
      </div>
      <AdminLoginForm />
    </section>
  );
}
