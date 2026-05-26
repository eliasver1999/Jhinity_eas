import { notFound } from "next/navigation";
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  approvalEvents,
  approvalPolicies,
  approvalRequests,
  easConnections,
  users,
} from "@/db/schema";
import { getActiveOrg } from "@/lib/org";
import { auth } from "@/auth";
import { approveAction, rejectAction } from "@/actions/approvals";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = (await getActiveOrg())!;
  const session = await auth();

  const [req] = await db
    .select()
    .from(approvalRequests)
    .where(
      and(eq(approvalRequests.id, id), eq(approvalRequests.organizationId, org.id)),
    )
    .limit(1);
  if (!req) notFound();

  const [policy] = await db
    .select()
    .from(approvalPolicies)
    .where(
      and(
        eq(approvalPolicies.organizationId, org.id),
        eq(approvalPolicies.buildProfile, req.buildProfile),
      ),
    )
    .limit(1);

  const events = await db
    .select({
      id: approvalEvents.id,
      type: approvalEvents.type,
      comment: approvalEvents.comment,
      createdAt: approvalEvents.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(approvalEvents)
    .leftJoin(users, eq(users.id, approvalEvents.userId))
    .where(eq(approvalEvents.approvalRequestId, req.id))
    .orderBy(asc(approvalEvents.createdAt));

  const [connection] = await db
    .select({ expoAccountName: easConnections.expoAccountName })
    .from(easConnections)
    .where(eq(easConnections.organizationId, org.id))
    .limit(1);

  const easBuildUrl =
    connection && req.appSlug
      ? `https://expo.dev/accounts/${connection.expoAccountName}/projects/${req.appSlug}/builds/${req.buildId}`
      : null;

  const canDecide =
    req.status === "pending" &&
    policy &&
    (policy.approverRole === "admin"
      ? org.role === "owner" || org.role === "admin"
      : org.role === "owner");

  const alreadyDecided = events.some(
    (e) =>
      (e.type === "approved" || e.type === "rejected") &&
      session?.user &&
      (e.userEmail === session.user.email || e.userName === session.user.name),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/approvals"
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            ← Approvals
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {req.appName ?? req.appSlug ?? "Untitled project"}{" "}
            <span className="text-neutral-400">·</span>{" "}
            <code className="text-base font-normal">{req.buildProfile}</code>
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Requested {req.createdAt.toLocaleString()} · {req.platform?.toLowerCase()}
          </p>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <section className="grid gap-4 rounded-lg border border-neutral-200 bg-white p-5 sm:grid-cols-2 dark:border-neutral-800 dark:bg-neutral-950">
        <Field label="Commit">
          {req.gitCommitHash ? (
            <div>
              <code className="text-xs">{req.gitCommitHash.slice(0, 12)}</code>
              {req.gitCommitMessage && (
                <div className="mt-0.5 text-xs text-neutral-500">
                  {req.gitCommitMessage.split("\n")[0]}
                </div>
              )}
            </div>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Initiated by">{req.initiatingActor ?? "—"}</Field>
        <Field label="Approvals">
          {req.approvalCount} of {req.requiredApprovals} required
          {policy && (
            <span className="ml-2 text-xs text-neutral-500">
              ({policy.approverRole}+)
            </span>
          )}
        </Field>
        <Field label="Build">
          {easBuildUrl ? (
            <a
              href={easBuildUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline-offset-4 hover:underline"
            >
              View on EAS ↗
            </a>
          ) : (
            "—"
          )}
        </Field>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Timeline</h2>
        <ol className="space-y-3">
          {events.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950"
            >
              <EventDot type={e.type} />
              <div className="flex-1 text-sm">
                <div>
                  <span className="font-medium">
                    {e.userName ?? e.userEmail ?? "Someone"}
                  </span>{" "}
                  <span className="text-neutral-500">
                    {labelForEvent(e.type)} · {e.createdAt.toLocaleString()}
                  </span>
                </div>
                {e.comment && (
                  <div className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                    {e.comment}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {canDecide && !alreadyDecided && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-sm font-medium">Your decision</h2>
          <p className="mt-1 text-xs text-neutral-500">
            One decision per reviewer. Comment is optional.
          </p>
          <form
            action={approveAction.bind(null, req.id)}
            className="mt-4 flex flex-col gap-3"
          >
            <textarea
              name="comment"
              rows={2}
              maxLength={2000}
              placeholder="Comment (optional)"
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Approve
              </button>
              <button
                type="submit"
                formAction={rejectAction.bind(null, req.id)}
                className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Reject
              </button>
            </div>
          </form>
        </section>
      )}

      {canDecide && alreadyDecided && (
        <p className="text-sm text-neutral-500">You&apos;ve already cast a decision on this request.</p>
      )}

      {!canDecide && req.status === "pending" && (
        <p className="text-sm text-neutral-500">
          You don&apos;t have permission to decide on this build profile.
        </p>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

function EventDot({ type }: { type: string }) {
  const cls =
    type === "approved"
      ? "bg-emerald-500"
      : type === "rejected"
        ? "bg-red-500"
        : type === "comment"
          ? "bg-neutral-400"
          : "bg-blue-500";
  return <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

function labelForEvent(type: string): string {
  switch (type) {
    case "created":
      return "opened the request";
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "comment":
      return "commented";
    default:
      return type;
  }
}
