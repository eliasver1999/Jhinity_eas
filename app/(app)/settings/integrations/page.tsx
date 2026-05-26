import { eq } from "drizzle-orm";
import { db } from "@/db";
import { easConnections } from "@/db/schema";
import { getActiveOrg } from "@/lib/org";
import { disconnectEasAction } from "@/actions/integrations";
import ConnectEasForm from "@/components/ConnectEasForm";

export default async function IntegrationsPage() {
  const org = (await getActiveOrg())!;
  const [connection] = await db
    .select({
      expoUsername: easConnections.expoUsername,
      expoAccountName: easConnections.expoAccountName,
      validatedAt: easConnections.validatedAt,
    })
    .from(easConnections)
    .where(eq(easConnections.organizationId, org.id))
    .limit(1);

  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Connect external services to {org.name}.
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-medium">Expo (EAS)</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Fetches builds, submissions, and updates for the connected Expo account.
            </p>
          </div>
          {connection && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
              Connected
            </span>
          )}
        </div>

        {connection ? (
          <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="text-sm">
              <div>
                Account: <span className="font-medium">{connection.expoAccountName}</span>
              </div>
              <div className="mt-0.5 text-xs text-neutral-500">
                Token added by {connection.expoUsername}, validated{" "}
                {connection.validatedAt.toLocaleString()}
              </div>
            </div>
            {canManage && (
              <form action={disconnectEasAction}>
                <button
                  type="submit"
                  className="rounded-md border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-red-50 hover:text-red-700 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-red-950/40"
                >
                  Disconnect
                </button>
              </form>
            )}
          </div>
        ) : canManage ? (
          <ConnectEasForm />
        ) : (
          <p className="mt-4 text-sm text-neutral-500">
            Only owners and admins can connect EAS.
          </p>
        )}
      </section>
    </div>
  );
}
