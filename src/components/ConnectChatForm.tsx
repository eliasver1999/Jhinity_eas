"use client";

import { useActionState } from "react";
import {
  connectChatAction,
  type ConnectChatState,
} from "@/actions/chat";
import type { ChatProvider } from "@/db/schema";
import { providerLabel, webhookInstructions, webhookUrlExample } from "@/lib/chat";

export default function ConnectChatForm({ provider }: { provider: ChatProvider }) {
  const action = connectChatAction.bind(null, provider);
  const [state, formAction, pending] = useActionState<ConnectChatState, FormData>(
    action,
    {},
  );
  const label = providerLabel(provider);

  return (
    <form action={formAction} className="mt-4 flex flex-col gap-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        {webhookInstructions(provider)}
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          {label} webhook URL
        </span>
        <input
          name="webhookUrl"
          required
          type="url"
          placeholder={webhookUrlExample(provider)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-neutral-600 dark:text-neutral-400">
          Channel label (optional, for display)
        </span>
        <input
          name="channelLabel"
          placeholder={provider === "slack" ? "#releases" : "releases"}
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
        {pending ? "Connecting..." : `Connect ${label}`}
      </button>
    </form>
  );
}
