"use client";

import { requestAdminPasswordReset } from "@/app/admin-password-reset-actions";
import { signInAdmin } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form-controls";

export function AdminLoginForm() {
  return (
    <div className="grid gap-4">
      <ActionForm action={signInAdmin} className="grid gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-6">
        {(state, pending) => (
          <>
            <Field label="Email" name="email" required type="email" />
            <Field label="Password" name="password" required type="password" />
            {state.message ? <p className="text-sm font-semibold text-red-300">{state.message}</p> : null}
            <SubmitButton pending={pending}>Sign In</SubmitButton>
          </>
        )}
      </ActionForm>

      <ActionForm action={requestAdminPasswordReset} className="grid gap-4 rounded-lg border border-white/10 bg-zinc-900/50 p-6">
        {(state, pending) => (
          <>
            <div>
              <h2 className="text-lg font-black text-zinc-50">Reset password</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                Enter the approved admin email and Supabase will send a recovery link.
              </p>
            </div>
            <Field label="Admin email" name="email" required type="email" />
            {state.message ? (
              <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
                {state.message}
              </p>
            ) : null}
            <SubmitButton pending={pending}>Send Reset Link</SubmitButton>
          </>
        )}
      </ActionForm>
    </div>
  );
}
