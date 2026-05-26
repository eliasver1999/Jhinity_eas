import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { createOrgAction } from "@/actions/orgs";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const existing = await getActiveOrg();
  if (existing) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Name your team</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          You can invite teammates next. This is the workspace you&apos;ll connect EAS to.
        </p>
      </div>

      <form action={createOrgAction} className="flex flex-col gap-3">
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoFocus
          placeholder="Acme Mobile"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Create team
        </button>
      </form>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
