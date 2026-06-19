'use client';

import { useActionState, type ReactNode } from 'react';

type ActionState = {
  ok: boolean;
  message: string;
};

type ActionFormProps = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel?: string;
};

export function ActionForm({ action, children, submitLabel = 'Submit' }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, { ok: false, message: '' });

  return (
    <form action={formAction} className="grid gap-4">
      {children}
      <button className="btn btn-primary" disabled={pending}>
        {pending ? 'Sending...' : submitLabel}
      </button>
      {state.message ? <p className={state.ok ? 'text-green-300' : 'text-red-300'}>{state.message}</p> : null}
    </form>
  );
}
