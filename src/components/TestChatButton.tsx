"use client";

import { useActionState } from "react";
import { testChatAction, type TestChatState } from "@/actions/chat";
import type { ChatProvider } from "@/db/schema";

export default function TestChatButton({ provider }: { provider: ChatProvider }) {
  const action = testChatAction.bind(null, provider);
  const [state, formAction, pending] = useActionState<TestChatState, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        {pending ? "Sending..." : "Send test"}
      </button>
      {state.error && (
        <span className="text-xs text-red-600 dark:text-red-400">{state.error}</span>
      )}
      {state.ok && <span className="text-xs text-emerald-600">Sent.</span>}
    </form>
  );
}
