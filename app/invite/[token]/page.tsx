import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { invitations, organizations, users } from "@/db/schema";
import { acceptInviteAction } from "@/actions/invites";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [invite] = await db
    .select({
      email: invitations.email,
      expiresAt: invitations.expiresAt,
      orgName: organizations.name,
      inviterName: users.name,
      inviterEmail: users.email,
    })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.organizationId))
    .leftJoin(users, eq(users.id, invitations.invitedByUserId))
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invite) notFound();

  const expired = invite.expiresAt.getTime() < Date.now();
  const session = await auth();
  const callbackUrl = `/invite/${token}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Join {invite.orgName}
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {invite.inviterName ?? invite.inviterEmail ?? "Your team"} invited{" "}
          <span className="font-medium text-neutral-800 dark:text-neutral-200">
            {invite.email}
          </span>{" "}
          to {invite.orgName} on EAS Dashboard.
        </p>
      </div>

      {expired ? (
        <Notice tone="error">This invitation has expired. Ask the inviter to resend it.</Notice>
      ) : !session?.user ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Sign in with {invite.email} to accept.
          </p>
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: callbackUrl });
            }}
          >
            <button className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
              Continue with GitHub
            </button>
          </form>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <button className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
              Continue with Google
            </button>
          </form>
        </div>
      ) : session.user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
        <div className="flex flex-col gap-3">
          <Notice tone="warn">
            You&apos;re signed in as{" "}
            <span className="font-medium">{session.user.email}</span>, but this invite is
            for <span className="font-medium">{invite.email}</span>.
          </Notice>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: callbackUrl });
            }}
          >
            <button className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800">
              Sign out and try again
            </button>
          </form>
        </div>
      ) : (
        <form action={acceptInviteAction.bind(null, token)}>
          <button
            type="submit"
            className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Accept invitation
          </button>
        </form>
      )}
    </main>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "warn";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200"
      : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200";
  return <div className={`rounded-md border p-3 text-sm ${cls}`}>{children}</div>;
}
