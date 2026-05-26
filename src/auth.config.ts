import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

// Edge-safe slice of the Auth.js config: providers + JWT callbacks only.
// The full config in auth.ts spreads this and adds the Drizzle adapter,
// which can't run in middleware (postgres-js isn't Edge-compatible).
export default {
  providers: [GitHub, Google],
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.uid = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.uid) session.user.id = token.uid as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
