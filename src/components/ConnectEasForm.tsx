"use client";

import { useActionState } from "react";
import { connectEasAction, type ConnectEasState } from "@/actions/integrations";

export default function ConnectEasForm() {
  const [state, formAction, pending] = useActionState<ConnectEasState, FormData>(
    connectEasAction,
    {},
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Generate a personal access token at{" "}
        <a
          href="https://expo.dev/settings/access-tokens"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          expo.dev/settings/access-tokens
        </a>
        . It is encrypted at rest with AES-256-GCM.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">Personal access token</span>
        <textarea
          name="token"
          required
          rows={3}
          placeholder="exp_..."
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          Expo account name (optional — first accessible account used if blank)
        </span>
        <input
          name="accountName"
          placeholder="acme-mobile"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      {state.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
      >
        {pending ? "Connecting..." : "Connect"}
      </button>
    </form>
  );
}
