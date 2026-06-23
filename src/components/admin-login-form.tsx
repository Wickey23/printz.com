"use client";

import { signInAdmin } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton } from "@/components/form-controls";

export function AdminLoginForm() {
  return (
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
  );
}
