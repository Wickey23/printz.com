"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";

const initialState: ActionState = {
  ok: false,
  message: "",
};

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState, pending: boolean) => React.ReactNode;
  className?: string;
};

export function ActionForm({ action, children, className }: Props) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={className}>
      {children(state, pending)}
    </form>
  );
}
