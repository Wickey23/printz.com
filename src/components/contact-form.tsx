"use client";

import { submitContact } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SubmitButton, TextArea } from "@/components/form-controls";

export function ContactForm() {
  return (
    <ActionForm action={submitContact} className="grid gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
      {(state, pending) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field error={state.errors?.name} label="Name" name="name" required />
            <Field error={state.errors?.email} label="Email" name="email" required type="email" />
          </div>
          <TextArea error={state.errors?.message} label="Message" name="message" required rows={8} />
          {state.message ? (
            <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
              {state.message}
            </p>
          ) : null}
          <SubmitButton pending={pending}>Send Message</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
