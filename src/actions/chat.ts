"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatConnections, type ChatProvider } from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { encrypt, decrypt } from "@/lib/encryption";
import {
  buildTestMessage,
  ChatError,
  isValidWebhookUrl,
  postChatWebhook,
  providerLabel,
} from "@/lib/chat";

export type ConnectChatState = { error?: string };
export type TestChatState = { error?: string; ok?: boolean };

const connectSchema = z.object({
  webhookUrl: z.string().trim().min(40).max(500),
  channelLabel: z.string().trim().max(80).optional(),
});

export async function connectChatAction(
  provider: ChatProvider,
  _prev: ConnectChatState,
  formData: FormData,
): Promise<ConnectChatState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: `Only owners and admins can manage ${providerLabel(provider)}.` };
  }

  const parsed = connectSchema.safeParse({
    webhookUrl: formData.get("webhookUrl"),
    channelLabel: formData.get("channelLabel") || undefined,
  });
  if (!parsed.success) {
    return { error: `Paste your ${providerLabel(provider)} incoming webhook URL.` };
  }
  if (!isValidWebhookUrl(provider, parsed.data.webhookUrl)) {
    return {
      error:
        provider === "slack"
          ? "That doesn't look like a Slack incoming webhook (expected hooks.slack.com/services/...)."
          : "That doesn't look like a Discord webhook (expected discord.com/api/webhooks/...).",
    };
  }

  const enc = encrypt(parsed.data.webhookUrl);

  await db
    .insert(chatConnections)
    .values({
      organizationId: org.id,
      provider,
      channelLabel: parsed.data.channelLabel ?? null,
      webhookCiphertext: enc.ciphertext,
      webhookIv: enc.iv,
      webhookAuthTag: enc.authTag,
      addedByUserId: session.user.id,
    })
    .onConflictDoUpdate({
      target: [chatConnections.organizationId, chatConnections.provider],
      set: {
        channelLabel: parsed.data.channelLabel ?? null,
        webhookCiphertext: enc.ciphertext,
        webhookIv: enc.iv,
        webhookAuthTag: enc.authTag,
        addedByUserId: session.user.id,
      },
    });

  revalidatePath("/settings/integrations");
  return {};
}

export async function disconnectChatAction(provider: ChatProvider) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");
  if (org.role !== "owner" && org.role !== "admin") {
    throw new Error(`Only owners and admins can manage ${providerLabel(provider)}`);
  }

  await db
    .delete(chatConnections)
    .where(
      and(
        eq(chatConnections.organizationId, org.id),
        eq(chatConnections.provider, provider),
      ),
    );
  revalidatePath("/settings/integrations");
}

export async function testChatAction(
  provider: ChatProvider,
  _prev: TestChatState,
  _formData: FormData,
): Promise<TestChatState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };

  const [conn] = await db
    .select()
    .from(chatConnections)
    .where(
      and(
        eq(chatConnections.organizationId, org.id),
        eq(chatConnections.provider, provider),
      ),
    )
    .limit(1);
  if (!conn) return { error: `${providerLabel(provider)} isn't connected yet.` };

  try {
    const url = decrypt({
      ciphertext: conn.webhookCiphertext,
      iv: conn.webhookIv,
      authTag: conn.webhookAuthTag,
    });
    await postChatWebhook(url, buildTestMessage(provider, org.name));
  } catch (e) {
    return {
      error:
        e instanceof ChatError
          ? e.message
          : e instanceof Error
            ? e.message
            : `${providerLabel(provider)} post failed.`,
    };
  }
  return { ok: true };
}
