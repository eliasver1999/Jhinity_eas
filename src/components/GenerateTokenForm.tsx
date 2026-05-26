"use client";

import { useActionState, useState } from "react";
import {
  generateApiTokenAction,
  type GenerateTokenState,
} from "@/actions/api-tokens";

export default function GenerateTokenForm() {
  const [state, formAction, pending] = useActionState<GenerateTokenState, FormData>(
    generateApiTokenAction,
    {},
  );
  const [copied, setCopied] = useState(false);

  if (state.token) {
    return (
      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/40">
        <div className="text-sm font-medium text-amber-900 dark:text-amber-100">
          New token for <span className="font-mono">{state.name}</span>
        </div>
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
          Copy it now — we don&apos;t store the plaintext, so you can&apos;t see it again.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 break-all rounded bg-white p-2 font-mono text-xs dark:bg-neutral-900">
            {state.token}
          </code>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(state.token!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs hover:bg-amber-100 dark:border-amber-700 dark:bg-neutral-900 dark:hover:bg-amber-950/60"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">Token name</span>
        <input
          name="name"
          required
          placeholder="iPhone 15"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Generating..." : "Generate token"}
      </button>
      {state.error && (
        <div className="text-xs text-red-600 dark:text-red-400">{state.error}</div>
      )}
    </form>
  );
}
