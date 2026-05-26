import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireApiAuth(req);
  if (auth instanceof Response) return auth;
  return NextResponse.json({
    user: auth.user,
    org: auth.org,
  });
}
