"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalEvents,
  approvalPolicies,
  approvalRequests,
  approverRole as approverRoleEnum,
  easConnections,
} from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { decrypt } from "@/lib/encryption";
import { fetchRecentBuilds, EasError } from "@/lib/eas";

// ---- Sync builds → approval_requests ---------------------------------------

export type SyncState = {
  error?: string;
  created?: number;
};

export async function syncBuildsAction(
  _prev: SyncState | undefined,
  _formData: FormData,
): Promise<SyncState> {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) return { error: "No active organization." };

  const [connection] = await db
    .select()
    .from(easConnections)
    .where(eq(easConnections.organizationId, org.id))
    .limit(1);
  if (!connection) return { error: "Connect Expo first." };

  let builds;
  try {
    const token = decrypt({
      ciphertext: connection.tokenCiphertext,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag,
    });
    builds = await fetchRecentBuilds(token, connection.expoAccountName, 50);
  } catch (e) {
    return {
      error:
        e instanceof EasError && e.status === 401
          ? "Expo rejected the stored token. Reconnect from Integrations."
          : e instanceof Error
            ? e.message
            : "Failed to fetch builds from EAS.",
    };
  }

  const policies = await db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.organizationId, org.id));
  if (policies.length === 0) return { created: 0 };
  const byProfile = new Map(policies.map((p) => [p.buildProfile, p]));

  let created = 0;
  for (const b of builds) {
    if (!b.buildProfile) continue;
    const policy = byProfile.get(b.buildProfile);
    if (!policy) continue;

    const inserted = await db
      .insert(approvalRequests)
      .values({
        organizationId: org.id,
        buildId: b.id,
        buildProfile: b.buildProfile,
        appName: b.appName,
        appSlug: b.appSlug,
        platform: b.platform,
        gitCommitHash: b.gitCommitHash,
        gitCommitMessage: b.gitCommitMessage,
        initiatingActor: b.initiatingActor,
        buildCreatedAt: new Date(b.createdAt),
        status: "pending",
        requiredApprovals: policy.requiredApprovals,
        approvalCount: 0,
      })
      .onConflictDoNothing({
        target: [approvalRequests.organizationId, approvalRequests.buildId],
      })
      .returning({ id: approvalRequests.id });

    if (inserted[0]) {
      created += 1;
      await db.insert(approvalEvents).values({
        approvalRequestId: inserted[0].id,
        userId: session.user.id,
        type: "created",
      });
    }
  }

  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  return { created };
}

// ---- Approve / Reject -------------------------------------------------------

const decisionSchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

async function loadRequestForDecision(orgId: string, requestId: string) {
  const [req] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.organizationId, orgId),
      ),
    )
    .limit(1);
  return req;
}

async function userCanApprove(orgRole: string, buildProfile: string, orgId: string) {
  const [policy] = await db
    .select()
    .from(approvalPolicies)
    .where(
      and(
        eq(approvalPolicies.organizationId, orgId),
        eq(approvalPolicies.buildProfile, buildProfile),
      ),
    )
    .limit(1);
  if (!policy) return false;
  if (policy.approverRole === "owner") return orgRole === "owner";
  return orgRole === "owner" || orgRole === "admin";
}

async function recomputeApprovalCount(requestId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(approvalEvents)
    .where(
      and(
        eq(approvalEvents.approvalRequestId, requestId),
        eq(approvalEvents.type, "approved"),
      ),
    );
  return row?.n ?? 0;
}

export async function approveAction(requestId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");

  const req = await loadRequestForDecision(org.id, requestId);
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending") throw new Error("This request is already resolved");

  if (!(await userCanApprove(org.role, req.buildProfile, org.id))) {
    throw new Error("You don't have permission to approve this build profile");
  }

  const parsed = decisionSchema.safeParse({ comment: formData.get("comment") || undefined });
  if (!parsed.success) throw new Error("Comment too long");

  try {
    await db.insert(approvalEvents).values({
      approvalRequestId: req.id,
      userId: session.user.id,
      type: "approved",
      comment: parsed.data.comment ?? null,
    });
  } catch {
    throw new Error("You've already approved this request.");
  }

  const count = await recomputeApprovalCount(req.id);
  const becameApproved = count >= req.requiredApprovals;
  await db
    .update(approvalRequests)
    .set({
      approvalCount: count,
      status: becameApproved ? "approved" : "pending",
      updatedAt: new Date(),
    })
    .where(eq(approvalRequests.id, req.id));

  revalidatePath("/approvals");
  revalidatePath(`/approvals/${req.id}`);
  revalidatePath("/dashboard");
}

export async function rejectAction(requestId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");

  const req = await loadRequestForDecision(org.id, requestId);
  if (!req) throw new Error("Approval request not found");
  if (req.status !== "pending") throw new Error("This request is already resolved");

  if (!(await userCanApprove(org.role, req.buildProfile, org.id))) {
    throw new Error("You don't have permission to reject this build profile");
  }

  const parsed = decisionSchema.safeParse({ comment: formData.get("comment") || undefined });
  if (!parsed.success) throw new Error("Comment too long");

  try {
    await db.insert(approvalEvents).values({
      approvalRequestId: req.id,
      userId: session.user.id,
      type: "rejected",
      comment: parsed.data.comment ?? null,
    });
  } catch {
    throw new Error("You've already rejected this request.");
  }

  await db
    .update(approvalRequests)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(approvalRequests.id, req.id));

  revalidatePath("/approvals");
  revalidatePath(`/approvals/${req.id}`);
  revalidatePath("/dashboard");
}

// ---- Policies ---------------------------------------------------------------

const policySchema = z.object({
  buildProfile: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dot, dash, underscore"),
  requiredApprovals: z.coerce.number().int().min(1).max(20),
  approverRole: z.enum(approverRoleEnum),
});

export async function createPolicyAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");
  if (org.role !== "owner" && org.role !== "admin") {
    throw new Error("Only owners and admins can manage approval policies");
  }

  const parsed = policySchema.safeParse({
    buildProfile: formData.get("buildProfile"),
    requiredApprovals: formData.get("requiredApprovals"),
    approverRole: formData.get("approverRole"),
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid policy");

  await db
    .insert(approvalPolicies)
    .values({
      organizationId: org.id,
      buildProfile: parsed.data.buildProfile,
      requiredApprovals: parsed.data.requiredApprovals,
      approverRole: parsed.data.approverRole,
    })
    .onConflictDoUpdate({
      target: [approvalPolicies.organizationId, approvalPolicies.buildProfile],
      set: {
        requiredApprovals: parsed.data.requiredApprovals,
        approverRole: parsed.data.approverRole,
      },
    });

  revalidatePath("/settings/approvals");
}

export async function deletePolicyAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const org = await getActiveOrg();
  if (!org) throw new Error("No active organization");
  if (org.role !== "owner" && org.role !== "admin") {
    throw new Error("Only owners and admins can manage approval policies");
  }

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing policy id");

  await db
    .delete(approvalPolicies)
    .where(
      and(eq(approvalPolicies.id, id), eq(approvalPolicies.organizationId, org.id)),
    );

  revalidatePath("/settings/approvals");
}

// Used by /dashboard so we can decorate each build row with its approval state
// in a single query instead of one per row.
export async function approvalsByBuildId(orgId: string, buildIds: string[]) {
  if (buildIds.length === 0) return new Map<string, { id: string; status: string }>();
  const rows = await db
    .select({
      id: approvalRequests.id,
      buildId: approvalRequests.buildId,
      status: approvalRequests.status,
    })
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.organizationId, orgId),
        inArray(approvalRequests.buildId, buildIds),
      ),
    );
  return new Map(rows.map((r) => [r.buildId, { id: r.id, status: r.status }]));
}
