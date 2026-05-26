import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { memberships, organizations, type MemberRole } from "@/db/schema";
import { auth } from "@/auth";

const ACTIVE_ORG_COOKIE = "active_org";

export type ActiveOrg = {
  id: string;
  slug: string;
  name: string;
  role: MemberRole;
};

export async function getActiveOrg(): Promise<ActiveOrg | null> {
  const session = await auth();
  if (!session?.user) return null;

  const cookieStore = await cookies();
  const activeOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  if (activeOrgId) {
    const row = await db
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(
        and(
          eq(memberships.userId, session.user.id),
          eq(memberships.organizationId, activeOrgId),
        ),
      )
      .limit(1);
    if (row[0]) return row[0] as ActiveOrg;
  }

  const fallback = await db
    .select({
      id: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(eq(memberships.userId, session.user.id))
    .limit(1);

  return (fallback[0] as ActiveOrg | undefined) ?? null;
}

export async function setActiveOrg(orgId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
