import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvalPolicies, chatConnections, type ChatProvider } from "@/db/schema";
import { getActiveOrg } from "@/lib/org";
import { providerLabel } from "@/lib/chat";
import { createPolicyAction, deletePolicyAction } from "@/actions/approvals";

export default async function ApprovalSettingsPage() {
  const org = (await getActiveOrg())!;
  const policies = await db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.organizationId, org.id))
    .orderBy(asc(approvalPolicies.buildProfile));

  const chats = await db
    .select({
      id: chatConnections.id,
      provider: chatConnections.provider,
      channelLabel: chatConnections.channelLabel,
    })
    .from(chatConnections)
    .where(eq(chatConnections.organizationId, org.id));
  const chatById = new Map(chats.map((c) => [c.id, c]));

  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approval policies</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Define which EAS build profiles require approval, and where to notify.
        </p>
      </div>

      {canManage && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-sm font-medium">Add or update policy</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Existing policy with the same profile name will be updated.
          </p>
          <form
            action={createPolicyAction}
            className="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end"
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Build profile (matches eas.json)
              </span>
              <input
                name="buildProfile"
                required
                placeholder="production"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Required approvals
              </span>
              <input
                name="requiredApprovals"
                type="number"
                min={1}
                max={20}
                defaultValue={1}
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Approver role
              </span>
              <select
                name="approverRole"
                defaultValue="admin"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="admin">Admin or Owner</option>
                <option value="owner">Owner only</option>
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                Notify channel
              </span>
              <select
                name="chatConnectionId"
                defaultValue=""
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="">Broadcast to all connected channels</option>
                {chats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {providerLabel(c.provider as ChatProvider)} —{" "}
                    {c.channelLabel ?? "(unlabeled)"}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              className="sm:col-span-2 self-start rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Save policy
            </button>
          </form>

          {chats.length === 0 && (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
              No chat channels connected yet — policies will record approvals silently. Add one in{" "}
              <Link href="/settings/integrations" className="underline">
                Integrations
              </Link>
              .
            </p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">Active policies ({policies.length})</h2>
        {policies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
            No policies yet. Add one above to start gating builds.
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Profile</th>
                  <th className="px-4 py-2 font-medium">Required</th>
                  <th className="px-4 py-2 font-medium">Approver role</th>
                  <th className="px-4 py-2 font-medium">Notifies</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                {policies.map((p) => {
                  const chat = p.chatConnectionId
                    ? chatById.get(p.chatConnectionId)
                    : undefined;
                  return (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-mono text-xs">{p.buildProfile}</td>
                      <td className="px-4 py-3">{p.requiredApprovals}</td>
                      <td className="px-4 py-3 capitalize text-neutral-600 dark:text-neutral-400">
                        {p.approverRole === "admin" ? "Admin or Owner" : "Owner only"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {p.chatConnectionId ? (
                          chat ? (
                            <span>
                              <span className="font-medium">
                                {providerLabel(chat.provider as ChatProvider)}
                              </span>{" "}
                              <span className="text-neutral-500">
                                {chat.channelLabel ?? "(unlabeled)"}
                              </span>
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              Channel disconnected
                            </span>
                          )
                        ) : (
                          <span className="text-neutral-500">
                            Broadcast ({chats.length} channel{chats.length === 1 ? "" : "s"})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canManage && (
                          <form action={deletePolicyAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button
                              type="submit"
                              className="text-xs text-neutral-500 hover:text-red-600"
                            >
                              Delete
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
