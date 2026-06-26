"use client";

import { useActionState } from "react";
import { runProductCommandCenterDryRun, runProductCommandCenterLiveSync, type ActionState } from "@/app/actions";

const initialState: ActionState = { ok: true, message: "" };

export function ProductSyncDryRunButton() {
  const [dryRunState, dryRunAction, dryRunPending] = useActionState(runProductCommandCenterDryRun, initialState);
  const [liveState, liveAction, livePending] = useActionState(runProductCommandCenterLiveSync, initialState);
  const pending = dryRunPending || livePending;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <form action={dryRunAction}>
          <button
            className="h-10 rounded-md border border-amber-300/30 px-4 text-sm font-bold text-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {dryRunPending ? "Checking..." : "Dry run"}
          </button>
        </form>
        <form action={liveAction}>
          <button
            className="h-10 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {livePending ? "Syncing..." : "Sync Sheet + Backfill Site Products"}
          </button>
        </form>
      </div>
      <p className="max-w-md text-xs leading-5 text-zinc-400">
        Live sync imports checked Sheet rows into the site, imports Drive media, then refreshes the read-only Site Products tab from the current site database.
      </p>
      {dryRunState.message ? (
        <p className={dryRunState.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
          {dryRunState.message}
        </p>
      ) : null}
      {liveState.message ? (
        <p className={liveState.ok ? "text-sm font-semibold text-emerald-300" : "text-sm font-semibold text-red-300"}>
          {liveState.message}
        </p>
      ) : null}
    </div>
  );
}
