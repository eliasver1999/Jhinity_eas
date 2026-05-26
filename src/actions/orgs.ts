"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, memberships } from "@/db/schema";
import { auth } from "@/auth";
import { setActiveOrg, slugify } from "@/lib/org";

const createOrgSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function createOrgAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const parsed = createOrgSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error("Team name must be between 2 and 80 characters.");

  const base = slugify(parsed.data.name) || "team";
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const existing = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (!existing[0]) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const [org] = await db
    .insert(organizations)
    .values({ name: parsed.data.name, slug })
    .returning();

  await db.insert(memberships).values({
    userId: session.user.id,
    organizationId: org.id,
    role: "owner",
  });

  await setActiveOrg(org.id);
  redirect("/dashboard");
}
