import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { approvalRequests, type ApprovalStatus } from "@/db/schema";
import { getActiveOrg } from "@/lib/org";

const STATUSES: ApprovalStatus[] = ["pending", "approved", "rejected"];

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: rawStatus } = await searchParams;
  const status: ApprovalStatus =
    rawStatus === "approved" || rawStatus === "rejected" ? rawStatus : "pending";

  const org = (await getActiveOrg())!;

  const requests = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.organizationId, org.id),
        eq(approvalRequests.status, status),
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(100);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Builds that match an approval policy for {org.name}.
          </p>
        </div>
        <Link
          href="/settings/approvals"
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          Manage policies
        </Link>
      </div>

      <div className="flex gap-1 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "pending" ? "/approvals" : `/approvals?status=${s}`}
            className={`rounded-md px-3 py-1 capitalize ${
              s === status
                ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {requests.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
          No {status} requests.{" "}
          {status === "pending" && (
            <>
              Hit <span className="font-mono">Sync builds</span> on the dashboard after a
              gated build runs.
            </>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Profile</th>
                <th className="px-4 py-2 font-medium">Platform</th>
                <th className="px-4 py-2 font-medium">Commit</th>
                <th className="px-4 py-2 font-medium">Progress</th>
                <th className="px-4 py-2 font-medium">Requested</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">
                    {r.appName ?? r.appSlug ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.buildProfile}</td>
                  <td className="px-4 py-3 lowercase text-neutral-600 dark:text-neutral-400">
                    {r.platform}
                  </td>
                  <td className="px-4 py-3">
                    {r.gitCommitHash ? (
                      <div>
                        <code className="text-xs">{r.gitCommitHash.slice(0, 7)}</code>
                        {r.gitCommitMessage && (
                          <div className="text-xs text-neutral-500">
                            {r.gitCommitMessage.split("\n")[0].slice(0, 60)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {r.approvalCount} / {r.requiredApprovals}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {r.createdAt.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/approvals/${r.id}` as const}
                      className="text-xs underline-offset-4 hover:underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
