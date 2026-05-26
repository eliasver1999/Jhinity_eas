import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalEvents,
  approvalPolicies,
  approvalRequests,
  easConnections,
  users,
} from "@/db/schema";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  const [request] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.id, id),
        eq(approvalRequests.organizationId, auth.org.id),
      ),
    )
    .limit(1);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [policy] = await db
    .select()
    .from(approvalPolicies)
    .where(
      and(
        eq(approvalPolicies.organizationId, auth.org.id),
        eq(approvalPolicies.buildProfile, request.buildProfile),
      ),
    )
    .limit(1);

  const events = await db
    .select({
      id: approvalEvents.id,
      type: approvalEvents.type,
      comment: approvalEvents.comment,
      createdAt: approvalEvents.createdAt,
      userName: users.name,
      userEmail: users.email,
      userId: approvalEvents.userId,
    })
    .from(approvalEvents)
    .leftJoin(users, eq(users.id, approvalEvents.userId))
    .where(eq(approvalEvents.approvalRequestId, request.id))
    .orderBy(asc(approvalEvents.createdAt));

  const [connection] = await db
    .select({ expoAccountName: easConnections.expoAccountName })
    .from(easConnections)
    .where(eq(easConnections.organizationId, auth.org.id))
    .limit(1);

  const easBuildUrl =
    connection && request.appSlug
      ? `https://expo.dev/accounts/${connection.expoAccountName}/projects/${request.appSlug}/builds/${request.buildId}`
      : null;

  const canDecide =
    request.status === "pending" &&
    policy &&
    (policy.approverRole === "admin"
      ? auth.org.role === "owner" || auth.org.role === "admin"
      : auth.org.role === "owner");

  const alreadyDecided = events.some(
    (e) =>
      (e.type === "approved" || e.type === "rejected") && e.userId === auth.user.id,
  );

  return NextResponse.json({
    request,
    events,
    easBuildUrl,
    policy: policy
      ? { approverRole: policy.approverRole, requiredApprovals: policy.requiredApprovals }
      : null,
    canDecide: Boolean(canDecide),
    alreadyDecided,
  });
}
