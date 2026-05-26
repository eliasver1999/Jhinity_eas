"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { easConnections } from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { encrypt } from "@/lib/encryption";
import { fetchMeActor, EasError } from "@/lib/eas";

export type ConnectEasState = { error?: string };

const connectSchema = z.object({
  token: z.string().trim().min(20).max(500),
  accountName: z.string().trim().optional(),
});

export async function connectEasAction(
  _prev: ConnectEasState,
  formData: FormData,
): Promise<ConnectEasState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };
  if (org.role !== "owner" && org.role !== "admin") {
    return { error: "Only owners and admins can connect EAS." };
  }

  const parsed = connectSchema.safeParse({
    token: formData.get("token"),
    accountName: formData.get("accountName") || undefined,
  });
  if (!parsed.success) return { error: "Paste a valid EAS personal access token." };

  try {
    const actor = await fetchMeActor(parsed.data.token);
    if (actor.accounts.length === 0) {
      return { error: "This token has no Expo accounts attached." };
    }

    let account = actor.accounts[0];
    if (parsed.data.accountName) {
      const match = actor.accounts.find((a) => a.name === parsed.data.accountName);
      if (!match) {
        return {
          error: `Token doesn't have access to "${parsed.data.accountName}". Accessible: ${actor.accounts
            .map((a) => a.name)
            .join(", ")}`,
        };
      }
      account = match;
    }

    const enc = encrypt(parsed.data.token);
    const now = new Date();

    await db
      .insert(easConnections)
      .values({
        organizationId: org.id,
        expoUsername: actor.displayName,
        expoAccountName: account.name,
        tokenCiphertext: enc.ciphertext,
        tokenIv: enc.iv,
        tokenAuthTag: enc.authTag,
        addedByUserId: session.user.id,
        validatedAt: now,
      })
      .onConflictDoUpdate({
        target: easConnections.organizationId,
        set: {
          expoUsername: actor.displayName,
          expoAccountName: account.name,
          tokenCiphertext: enc.ciphertext,
          tokenIv: enc.iv,
          tokenAuthTag: enc.authTag,
          addedByUserId: session.user.id,
          validatedAt: now,
        },
      });
  } catch (e) {
    if (e instanceof EasError && e.status === 401) {
      return {
        error:
          "Expo rejected this token. Generate a new one at expo.dev/settings/access-tokens.",
      };
    }
    return { error: e instanceof Error ? e.message : "Unknown error connecting to EAS." };
  }

  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
  return {};
}

export async function disconnectEasAction() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");
  if (org.role !== "owner" && org.role !== "admin") {
    throw new Error("Only owners and admins can disconnect EAS");
  }

  await db.delete(easConnections).where(eq(easConnections.organizationId, org.id));
  revalidatePath("/settings/integrations");
  revalidatePath("/dashboard");
}
