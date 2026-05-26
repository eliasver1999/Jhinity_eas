"use client";

import { useActionState } from "react";
import { syncBuildsAction, type SyncState } from "@/actions/approvals";

export default function SyncBuildsButton() {
  const [state, formAction, pending] = useActionState<SyncState | undefined, FormData>(
    syncBuildsAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-3">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        {pending ? "Syncing..." : "Sync builds"}
      </button>
      {state?.error && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      {!state?.error && state?.created !== undefined && (
        <span className="text-xs text-neutral-500">
          {state.created === 0
            ? "Up to date."
            : `${state.created} new approval request${state.created === 1 ? "" : "s"}.`}
        </span>
      )}
    </form>
  );
}
