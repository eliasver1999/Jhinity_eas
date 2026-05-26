// Shared approve/reject logic used by both the web server actions and the
// mobile JSON API. Kept here so the two surfaces can't drift.

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalEvents,
  approvalPolicies,
  approvalRequests,
  chatConnections,
  type ChatProvider,
} from "@/db/schema";
import { decrypt } from "@/lib/encryption";
import { buildDecisionMessage, postChatWebhook } from "@/lib/chat";
import type { ApiAuth } from "@/lib/api-auth";

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
      console.warn(`[decide] failed to decrypt ${c.provider} webhook`, e);
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

export async function decideViaApi(
  kind: "approve" | "reject",
  requestId: string,
  auth: ApiAuth,
  commentRaw: string | undefined,
) {
  const comment =
    commentRaw && commentRaw.trim().length > 0
      ? commentRaw.trim().slice(0, 2000)
      : null;

  const [req] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.organizationId, auth.org.id),
      ),
    )
    .limit(1);
  if (!req) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (req.status !== "pending") {
    return NextResponse.json(
      { error: "This request is already resolved" },
      { status: 409 },
    );
  }

  const [policy] = await db
    .select()
    .from(approvalPolicies)
    .where(
      and(
        eq(approvalPolicies.organizationId, auth.org.id),
        eq(approvalPolicies.buildProfile, req.buildProfile),
      ),
    )
    .limit(1);
  if (!policy) {
    return NextResponse.json(
      { error: "This build profile has no active policy" },
      { status: 409 },
    );
  }

  const ok =
    policy.approverRole === "owner"
      ? auth.org.role === "owner"
      : auth.org.role === "owner" || auth.org.role === "admin";
  if (!ok) {
    return NextResponse.json(
      { error: "You don't have permission to decide on this build profile" },
      { status: 403 },
    );
  }

  try {
    await db.insert(approvalEvents).values({
      approvalRequestId: req.id,
      userId: auth.user.id,
      type: kind === "approve" ? "approved" : "rejected",
      comment,
    });
  } catch {
    return NextResponse.json(
      { error: `You've already ${kind === "approve" ? "approved" : "rejected"} this request.` },
      { status: 409 },
    );
  }

  let newStatus: "pending" | "approved" | "rejected" = req.status;
  let approvalCount = req.approvalCount;

  if (kind === "approve") {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(approvalEvents)
      .where(
        and(
          eq(approvalEvents.approvalRequestId, req.id),
          eq(approvalEvents.type, "approved"),
        ),
      );
    approvalCount = row?.n ?? 0;
    newStatus = approvalCount >= req.requiredApprovals ? "approved" : "pending";
    await db
      .update(approvalRequests)
      .set({ approvalCount, status: newStatus, updatedAt: new Date() })
      .where(eq(approvalRequests.id, req.id));
  } else {
    newStatus = "rejected";
    await db
      .update(approvalRequests)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(approvalRequests.id, req.id));
  }

  // Notify chat only on terminal transition.
  const shouldNotify =
    (kind === "approve" && newStatus === "approved") || kind === "reject";
  if (shouldNotify) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const decidedBy = auth.user.name ?? auth.user.email ?? "Someone";
    const all = await loadChatTargets(auth.org.id);
    const routed = selectTargets(all, policy.chatConnectionId);
    for (const target of routed) {
      try {
        await postChatWebhook(
          target.url,
          buildDecisionMessage(
            target.provider,
            {
              approvalRequestId: req.id,
              orgName: auth.org.name,
              appName: req.appName,
              appSlug: req.appSlug,
              buildProfile: req.buildProfile,
              platform: req.platform,
              gitCommitHash: req.gitCommitHash,
              gitCommitMessage: req.gitCommitMessage,
              decidedBy,
              comment,
              approvalCount,
              requiredApprovals: req.requiredApprovals,
              appUrl,
            },
            newStatus === "approved" ? "approved" : "rejected",
          ),
        );
      } catch (e) {
        console.warn(`[decide] ${target.provider} notify failed`, e);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    status: newStatus,
    approvalCount,
    requiredApprovals: req.requiredApprovals,
  });
}
