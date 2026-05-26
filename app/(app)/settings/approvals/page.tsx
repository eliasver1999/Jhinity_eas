import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvalPolicies } from "@/db/schema";
import { getActiveOrg } from "@/lib/org";
import { createPolicyAction, deletePolicyAction } from "@/actions/approvals";

export default async function ApprovalSettingsPage() {
  const org = (await getActiveOrg())!;
  const policies = await db
    .select()
    .from(approvalPolicies)
    .where(eq(approvalPolicies.organizationId, org.id))
    .orderBy(asc(approvalPolicies.buildProfile));

  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approval policies</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Define which EAS build profiles require approval before being shipped.
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
            className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
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
                className="w-32 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Save
            </button>
          </form>
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
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-mono text-xs">{p.buildProfile}</td>
                    <td className="px-4 py-3">{p.requiredApprovals}</td>
                    <td className="px-4 py-3 capitalize text-neutral-600 dark:text-neutral-400">
                      {p.approverRole === "admin" ? "Admin or Owner" : "Owner only"}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
