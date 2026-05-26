import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { easConnections } from "@/db/schema";
import { requireApiAuth } from "@/lib/api-auth";
import { decrypt } from "@/lib/encryption";
import { fetchRecentBuilds, EasError } from "@/lib/eas";
import { approvalsByBuildId } from "@/actions/approvals";

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (auth instanceof Response) return auth;

  const [connection] = await db
    .select()
    .from(easConnections)
    .where(eq(easConnections.organizationId, auth.org.id))
    .limit(1);

  if (!connection) {
    return NextResponse.json({ easConnected: false, builds: [] });
  }

  try {
    const token = decrypt({
      ciphertext: connection.tokenCiphertext,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag,
    });
    const builds = await fetchRecentBuilds(token, connection.expoAccountName, 25);
    const approvals = await approvalsByBuildId(
      auth.org.id,
      builds.map((b) => b.id),
    );
    return NextResponse.json({
      easConnected: true,
      expoAccountName: connection.expoAccountName,
      builds: builds.map((b) => ({
        ...b,
        easUrl: b.appSlug
          ? `https://expo.dev/accounts/${connection.expoAccountName}/projects/${b.appSlug}/builds/${b.id}`
          : null,
        approval: approvals.get(b.id) ?? null,
      })),
    });
  } catch (e) {
    const status = e instanceof EasError ? e.status : 500;
    return NextResponse.json(
      {
        easConnected: true,
        builds: [],
        error: e instanceof Error ? e.message : "Failed to fetch builds",
      },
      { status: status === 401 ? 502 : 502 }, // 502: upstream error, not auth error
    );
  }
}
