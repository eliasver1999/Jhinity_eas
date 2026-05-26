import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens, memberships, organizations, users } from "@/db/schema";
import { hashToken } from "./api-tokens";

export type ApiAuth = {
  user: { id: string; name: string | null; email: string | null };
  org: { id: string; name: string; slug: string; role: "owner" | "admin" | "member" };
  tokenId: string;
};

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Reads `Authorization: Bearer <token>` from the request, looks up the token
 * (hashed), and returns the bound user + organization. Returns a 401
 * NextResponse if anything is off — callers should `if (res instanceof Response)
 * return res;` to short-circuit.
 */
export async function requireApiAuth(req: Request): Promise<ApiAuth | NextResponse> {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) {
    return unauthorized("Missing Bearer token");
  }
  const token = header.slice("bearer ".length).trim();
  if (!token) return unauthorized("Empty token");

  const tokenHash = hashToken(token);
  const [row] = await db
    .select({
      tokenId: apiTokens.id,
      userId: apiTokens.userId,
      organizationId: apiTokens.organizationId,
      userName: users.name,
      userEmail: users.email,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      memberRole: memberships.role,
    })
    .from(apiTokens)
    .innerJoin(users, eq(users.id, apiTokens.userId))
    .innerJoin(organizations, eq(organizations.id, apiTokens.organizationId))
    .innerJoin(
      memberships,
      and(
        eq(memberships.userId, apiTokens.userId),
        eq(memberships.organizationId, apiTokens.organizationId),
      ),
    )
    .where(eq(apiTokens.tokenHash, tokenHash))
    .limit(1);

  if (!row) return unauthorized("Invalid token");

  // Fire-and-forget last-used update so the read path stays fast.
  db.update(apiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiTokens.id, row.tokenId))
    .catch((e) => console.warn("[api-auth] failed to update lastUsedAt", e));

  return {
    user: { id: row.userId, name: row.userName, email: row.userEmail },
    org: {
      id: row.organizationId,
      name: row.orgName,
      slug: row.orgSlug,
      role: row.memberRole,
    },
    tokenId: row.tokenId,
  };
}
