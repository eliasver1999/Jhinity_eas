import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { decideViaApi } from "@/lib/decide";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiAuth(req);
  if (auth instanceof Response) return auth;
  const { id } = await params;

  let comment: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    comment = typeof body?.comment === "string" ? body.comment : undefined;
  } catch {
    /* empty body is fine */
  }

  return decideViaApi("reject", id, auth, comment);
}
