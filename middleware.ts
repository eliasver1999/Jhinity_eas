import NextAuth from "next-auth";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/", "/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) return;
  if (pathname.startsWith("/invite/")) return;
  if (PUBLIC_PATHS.includes(pathname)) return;

  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
