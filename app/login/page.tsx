import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { from } = await searchParams;
  const redirectTo = from && from.startsWith("/") ? from : "/dashboard";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Use the same account your team uses for source control.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Continue with GitHub
          </button>
        </form>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
