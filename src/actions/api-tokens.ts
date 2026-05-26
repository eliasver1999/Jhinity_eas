"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { generatePlaintextToken, hashToken } from "@/lib/api-tokens";

export type GenerateTokenState = {
  error?: string;
  token?: string; // returned ONCE, never again
  name?: string;
};

const generateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function generateApiTokenAction(
  _prev: GenerateTokenState,
  formData: FormData,
): Promise<GenerateTokenState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };

  const parsed = generateSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: "Give this token a name (e.g. iPhone 15)." };

  const plaintext = generatePlaintextToken();
  const tokenHash = hashToken(plaintext);

  await db.insert(apiTokens).values({
    userId: session.user.id,
    organizationId: org.id,
    name: parsed.data.name,
    tokenHash,
  });

  revalidatePath("/settings/devices");
  return { token: plaintext, name: parsed.data.name };
}

export async function revokeApiTokenAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing token id");

  // Users can only revoke their own tokens.
  await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, session.user.id)));

  revalidatePath("/settings/devices");
}
