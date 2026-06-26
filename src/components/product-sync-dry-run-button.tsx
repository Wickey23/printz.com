"use client";

import { useActionState } from "react";
import { runProductCommandCenterDryRun, type ActionState } from "@/app/actions";

const initialState: ActionState = { ok: true, message: "" };

export function ProductSyncDryRunButton() {
  const [state, action, pending] = useActionState(runProductCommandCenterDryRun, initialState);

  return (
    <div className="grid gap-2">
      <form action={action}>
        <button
          className="h-10 rounded-md bg-amber-300 px-4 text-sm font-bold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Running dry run..." : "Run sync dry run"}
        </button>
      </form>
      {state.message ? (
        <p className={state.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}