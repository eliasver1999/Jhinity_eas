import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, type ApprovalStatus } from "@/db/schema";
import { requireApiAuth } from "@/lib/api-auth";

const VALID_STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (auth instanceof Response) return auth;

  const url = new URL(req.url);
  const requested = url.searchParams.get("status") as ApprovalStatus | null;
  const status: ApprovalStatus =
    requested && VALID_STATUSES.includes(requested) ? requested : "pending";

  const rows = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.organizationId, auth.org.id),
        eq(approvalRequests.status, status),
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(100);

  return NextResponse.json({ approvals: rows });
}
