import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { getActiveOrg } from "@/lib/org";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const org = await getActiveOrg();
  if (!org) redirect("/onboarding");

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold">
              {org.name}
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <Link href="/dashboard" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Builds
              </Link>
              <Link
                href="/approvals"
                className="hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Approvals
              </Link>
              <Link
                href="/settings/integrations"
                className="hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Integrations
              </Link>
              <Link
                href="/settings/team"
                className="hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Team
              </Link>
              <Link
                href="/settings/devices"
                className="hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                Devices
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
    </div>
  );
}
