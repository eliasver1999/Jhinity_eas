import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">EAS Dashboard</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          The team layer on top of EAS — visibility, approvals, and a mobile companion for
          your Expo builds.
        </p>
      </div>
      <div>
        <Link
          href="/login"
          className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
