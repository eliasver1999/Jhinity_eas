"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, memberships, organizations, users } from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg, setActiveOrg } from "@/lib/org";
import { sendInviteEmail } from "@/lib/email";

const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export async function inviteMemberAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");
  if (org.role !== "owner" && org.role !== "admin") {
    throw new Error("Only owners and admins can invite members");
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role") ?? "member",
  });
  if (!parsed.success) throw new Error("Enter a valid email address");

  // If the email already belongs to a member, no-op rather than create a dangling invite.
  const alreadyMember = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.organizationId, org.id), eq(users.email, parsed.data.email)))
    .limit(1);
  if (alreadyMember[0]) {
    revalidatePath("/settings/team");
    return;
  }

  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  // Upsert: re-inviting the same email refreshes the token + expiry.
  await db
    .insert(invitations)
    .values({
      organizationId: org.id,
      email: parsed.data.email,
      role: parsed.data.role,
      token,
      expiresAt,
      invitedByUserId: session.user.id,
    })
    .onConflictDoUpdate({
      target: [invitations.organizationId, invitations.email],
      set: { token, expiresAt, role: parsed.data.role, invitedByUserId: session.user.id },
    });

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await sendInviteEmail({
    to: parsed.data.email,
    orgName: org.name,
    inviterName: session.user.name ?? session.user.email ?? null,
    link: `${appUrl}/invite/${token}`,
  });

  revalidatePath("/settings/team");
}

export async function revokeInviteAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");
  if (org.role !== "owner" && org.role !== "admin") {
    throw new Error("Only owners and admins can revoke invites");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing invitation id");

  await db
    .delete(invitations)
    .where(and(eq(invitations.id, id), eq(invitations.organizationId, org.id)));

  revalidatePath("/settings/team");
}

export async function acceptInviteAction(token: string) {
  const session = await auth();
  if (!session?.user) {
    // Round-trip through login; we come back to /invite/[token] post-auth.
    redirect(`/login?from=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const [invite] = await db
    .select({
      id: invitations.id,
      organizationId: invitations.organizationId,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      orgName: organizations.name,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invite) throw new Error("Invitation not found or already used");
  if (invite.expiresAt.getTime() < Date.now()) {
    await db.delete(invitations).where(eq(invitations.id, invite.id));
    throw new Error("This invitation has expired");
  }
  if (session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error(
      `This invitation is for ${invite.email}. Sign in with that account to accept.`,
    );
  }

  await db
    .insert(memberships)
    .values({
      userId: session.user.id,
      organizationId: invite.organizationId,
      role: invite.role,
    })
    .onConflictDoNothing({
      target: [memberships.userId, memberships.organizationId],
    });

  await db.delete(invitations).where(eq(invitations.id, invite.id));
  await setActiveOrg(invite.organizationId);

  redirect("/dashboard");
}
