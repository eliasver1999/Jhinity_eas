import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { auth } from "@/auth";
import { getActiveOrg } from "@/lib/org";
import { revokeApiTokenAction } from "@/actions/api-tokens";
import GenerateTokenForm from "@/components/GenerateTokenForm";

export default async function DevicesPage() {
  const session = await auth();
  const org = (await getActiveOrg())!;

  const tokens = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.userId, session!.user.id),
        eq(apiTokens.organizationId, org.id),
      ),
    )
    .orderBy(desc(apiTokens.createdAt));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices &amp; tokens</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          API tokens for the mobile companion. Each token is scoped to your account in{" "}
          {org.name}.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 className="text-sm font-medium">Generate token</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Name it after the device you&apos;ll use it on so you can revoke later if lost.
        </p>
        <GenerateTokenForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Your tokens ({tokens.length})</h2>
        {tokens.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No tokens yet. Generate one above.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Created</th>
                  <th className="px-4 py-2 font-medium">Last used</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                {tokens.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {t.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {t.lastUsedAt ? t.lastUsedAt.toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={revokeApiTokenAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          className="text-xs text-neutral-500 hover:text-red-600"
                        >
                          Revoke
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
