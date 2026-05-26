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
  chatConnections,
  easConnections,
  type ChatProvider,
} from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { decrypt } from "@/lib/encryption";
import { fetchRecentBuilds, EasError } from "@/lib/eas";
import { buildApprovalMessage, buildDecisionMessage, postChatWebhook } from "@/lib/chat";

// ---- Shared chat notify helper ---------------------------------------------

type ChatTarget = { id: string; provider: ChatProvider; url: string };

async function loadChatTargets(orgId: string): Promise<ChatTarget[]> {
  const rows = await db
    .select()
    .from(chatConnections)
    .where(eq(chatConnections.organizationId, orgId));
  const out: ChatTarget[] = [];
  for (const c of rows) {
    try {
      out.push({
        id: c.id,
        provider: c.provider as ChatProvider,
        url: decrypt({
          ciphertext: c.webhookCiphertext,
          iv: c.webhookIv,
          authTag: c.webhookAuthTag,
        }),
      });
    } catch (e) {
      console.warn(`[chat] failed to decrypt ${c.provider} webhook`, e);
    }
  }
  return out;
}

function selectTargets(
  all: ChatTarget[],
  policyChatConnectionId: string | null,
): ChatTarget[] {
  if (!policyChatConnectionId) return all;
  const t = all.find((x) => x.id === policyChatConnectionId);
  return t ? [t] : [];
}

async function postToTargets(
  targets: ChatTarget[],
  build: (provider: ChatProvider) => Record<string, unknown>,
) {
  for (const target of targets) {
    try {
      await postChatWebhook(target.url, build(target.provider));
    } catch (e) {
      console.warn(`[chat] ${target.provider} notify failed`, e);
    }
  }
}

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

  // Pull all chat webhooks once so we don't re-load per iteration.
  const chatTargets = await loadChatTargets(org.id);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  let created = 0;
  for (const b of builds) {
    const buildProfile = b.buildProfile;
    if (!buildProfile) continue;
    const policy = byProfile.get(buildProfile);
    if (!policy) continue;

    const inserted = await db
      .insert(approvalRequests)
      .values({
        organizationId: org.id,
        buildId: b.id,
        buildProfile,
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

      const routed = selectTargets(chatTargets, policy.chatConnectionId);
      await postToTargets(routed, (provider) =>
        buildApprovalMessage(provider, {
          approvalRequestId: inserted[0].id,
          orgName: org.name,
          appName: b.appName,
          appSlug: b.appSlug,
          buildProfile,
          platform: b.platform,
          gitCommitHash: b.gitCommitHash,
          gitCommitMessage: b.gitCommitMessage,
          initiatingActor: b.initiatingActor,
          required: policy.requiredApprovals,
          appUrl,
        }),
      );
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

async function loadPolicyForRequest(orgId: string, buildProfile: string) {
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
  return policy ?? null;
}

function canDecide(role: string, policyApproverRole: string) {
  if (policyApproverRole === "owner") return role === "owner";
  return role === "owner" || role === "admin";
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

  const policy = await loadPolicyForRequest(org.id, req.buildProfile);
  if (!policy) throw new Error("This build profile no longer has an active policy.");
  if (!canDecide(org.role, policy.approverRole)) {
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

  // Notify chat only on the transition to "approved" (the last needed
  // approval). Per-vote pings would be noisy.
  if (becameApproved) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const decidedBy = session.user.name ?? session.user.email ?? "Someone";
    const all = await loadChatTargets(org.id);
    const routed = selectTargets(all, policy.chatConnectionId);
    await postToTargets(routed, (provider) =>
      buildDecisionMessage(
        provider,
        {
          approvalRequestId: req.id,
          orgName: org.name,
          appName: req.appName,
          appSlug: req.appSlug,
          buildProfile: req.buildProfile,
          platform: req.platform,
          gitCommitHash: req.gitCommitHash,
          gitCommitMessage: req.gitCommitMessage,
          decidedBy,
          comment: parsed.data.comment ?? null,
          approvalCount: count,
          requiredApprovals: req.requiredApprovals,
          appUrl,
        },
        "approved",
      ),
    );
  }

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

  const policy = await loadPolicyForRequest(org.id, req.buildProfile);
  if (!policy) throw new Error("This build profile no longer has an active policy.");
  if (!canDecide(org.role, policy.approverRole)) {
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

  // Single reject is terminal — always notify.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const decidedBy = session.user.name ?? session.user.email ?? "Someone";
  const all = await loadChatTargets(org.id);
  const routed = selectTargets(all, policy.chatConnectionId);
  await postToTargets(routed, (provider) =>
    buildDecisionMessage(
      provider,
      {
        approvalRequestId: req.id,
        orgName: org.name,
        appName: req.appName,
        appSlug: req.appSlug,
        buildProfile: req.buildProfile,
        platform: req.platform,
        gitCommitHash: req.gitCommitHash,
        gitCommitMessage: req.gitCommitMessage,
        decidedBy,
        comment: parsed.data.comment ?? null,
        approvalCount: req.approvalCount,
        requiredApprovals: req.requiredApprovals,
        appUrl,
      },
      "rejected",
    ),
  );

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
  chatConnectionId: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional(),
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
    chatConnectionId: formData.get("chatConnectionId"),
  });
  if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? "Invalid policy");

  // If a chat connection was picked, verify it belongs to this org. Prevents
  // cross-tenant assignment via a forged form post.
  let chatConnectionId: string | null = parsed.data.chatConnectionId ?? null;
  if (chatConnectionId) {
    const [owned] = await db
      .select({ id: chatConnections.id })
      .from(chatConnections)
      .where(
        and(
          eq(chatConnections.id, chatConnectionId),
          eq(chatConnections.organizationId, org.id),
        ),
      )
      .limit(1);
    if (!owned) throw new Error("Selected chat channel doesn't belong to this org");
  }

  await db
    .insert(approvalPolicies)
    .values({
      organizationId: org.id,
      buildProfile: parsed.data.buildProfile,
      requiredApprovals: parsed.data.requiredApprovals,
      approverRole: parsed.data.approverRole,
      chatConnectionId,
    })
    .onConflictDoUpdate({
      target: [approvalPolicies.organizationId, approvalPolicies.buildProfile],
      set: {
        requiredApprovals: parsed.data.requiredApprovals,
        approverRole: parsed.data.approverRole,
        chatConnectionId,
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
