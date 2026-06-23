"use client";

import { submitSuggestion } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Field, SelectField, SubmitButton, TextArea } from "@/components/form-controls";
import { categories } from "@/lib/config";

export function SuggestionForm() {
  return (
    <ActionForm action={submitSuggestion} className="grid gap-5 rounded-lg border border-white/10 bg-zinc-900/70 p-5 sm:p-7">
      {(state, pending) => (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field error={state.errors?.name} label="Name" name="name" required />
            <Field error={state.errors?.email} label="Email" name="email" required type="email" />
          </div>
          <Field error={state.errors?.title} label="Product idea title" name="title" required />
          <TextArea error={state.errors?.description} label="Description" name="description" required rows={6} />
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField error={state.errors?.category} label="Category" name="category" options={categories} />
            <Field error={state.errors?.budget_range} label="Budget range" name="budget_range" placeholder="$25-$75" />
          </div>
          <Field error={state.errors?.reference_link} label="Reference link" name="reference_link" placeholder="https://" />
          {state.message ? (
            <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
              {state.message}
            </p>
          ) : null}
          <SubmitButton pending={pending}>Send Suggestion</SubmitButton>
        </>
      )}
    </ActionForm>
  );
}
