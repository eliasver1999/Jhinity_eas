import Link from "next/link";
import type { Route } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { easConnections } from "@/db/schema";
import { getActiveOrg } from "@/lib/org";
import { decrypt } from "@/lib/encryption";
import { fetchRecentBuilds, EasError, type EasBuild } from "@/lib/eas";
import { approvalsByBuildId } from "@/actions/approvals";
import SyncBuildsButton from "@/components/SyncBuildsButton";

export const dynamic = "force-dynamic"; // builds list is per-request

type Approval = { id: string; status: string };

export default async function DashboardPage() {
  const org = (await getActiveOrg())!;
  const [connection] = await db
    .select()
    .from(easConnections)
    .where(eq(easConnections.organizationId, org.id))
    .limit(1);

  if (!connection) {
    return (
      <div className="flex flex-col gap-6">
        <Header org={org.name} />
        <EmptyState
          title="No Expo account connected"
          body={`Connect an EAS personal access token to start seeing builds for ${org.name}.`}
          ctaHref="/settings/integrations"
          ctaLabel="Connect Expo"
        />
      </div>
    );
  }

  let builds: EasBuild[] = [];
  let fetchError: string | null = null;
  let approvalsByBuild = new Map<string, Approval>();

  try {
    const token = decrypt({
      ciphertext: connection.tokenCiphertext,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag,
    });
    builds = await fetchRecentBuilds(token, connection.expoAccountName, 25);
    builds = builds.map((b) => ({
      ...b,
      easUrl: b.appSlug
        ? `https://expo.dev/accounts/${connection.expoAccountName}/projects/${b.appSlug}/builds/${b.id}`
        : null,
    }));
    approvalsByBuild = await approvalsByBuildId(
      org.id,
      builds.map((b) => b.id),
    );
  } catch (e) {
    fetchError =
      e instanceof EasError && e.status === 401
        ? "Expo rejected the stored token. Reconnect from Integrations."
        : e instanceof Error
          ? e.message
          : "Failed to fetch builds from EAS.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <Header
          org={org.name}
          subtitle={`Recent builds from @${connection.expoAccountName} on EAS.`}
        />
        <SyncBuildsButton />
      </div>

      {fetchError ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <div className="font-medium">Couldn&apos;t reach EAS</div>
          <div className="mt-1">{fetchError}</div>
          <Link
            href="/settings/integrations"
            className="mt-2 inline-block text-xs underline"
          >
            Check integration
          </Link>
        </div>
      ) : builds.length === 0 ? (
        <EmptyState
          title="No builds yet"
          body={`@${connection.expoAccountName} hasn't produced any EAS builds we can see. Run an EAS build and refresh.`}
        />
      ) : (
        <BuildsTable builds={builds} approvalsByBuild={approvalsByBuild} />
      )}
    </div>
  );
}

function Header({ org, subtitle }: { org: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Builds</h1>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        {subtitle ?? `EAS builds for ${org}.`}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  body: string;
  ctaHref?: Route;
  ctaLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-neutral-300 p-12 text-center dark:border-neutral-700">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-sm text-neutral-500">{body}</div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="mt-4 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

function BuildsTable({
  builds,
  approvalsByBuild,
}: {
  builds: EasBuild[];
  approvalsByBuild: Map<string, Approval>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
          <tr>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Project</th>
            <th className="px-4 py-2 font-medium">Profile</th>
            <th className="px-4 py-2 font-medium">Platform</th>
            <th className="px-4 py-2 font-medium">Commit</th>
            <th className="px-4 py-2 font-medium">Approval</th>
            <th className="px-4 py-2 font-medium">Age</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
          {builds.map((b) => {
            const approval = approvalsByBuild.get(b.id);
            return (
              <tr key={b.id}>
                <td className="px-4 py-3">
                  <StatusPill status={b.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{b.appName ?? b.appSlug ?? "—"}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600 dark:text-neutral-400">
                  {b.buildProfile ?? "—"}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {b.platform.toLowerCase()}
                </td>
                <td className="px-4 py-3">
                  {b.gitCommitHash ? (
                    <div>
                      <code className="text-xs">{b.gitCommitHash.slice(0, 7)}</code>
                      {b.gitCommitMessage && (
                        <div className="text-xs text-neutral-500">
                          {b.gitCommitMessage.split("\n")[0].slice(0, 50)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {approval ? (
                    <Link
                      href={`/approvals/${approval.id}` as Route}
                      className="hover:opacity-80"
                    >
                      <ApprovalPill status={approval.status} />
                    </Link>
                  ) : (
                    <span className="text-xs text-neutral-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                  {relativeTime(b.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  {b.easUrl ? (
                    <a
                      href={b.easUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-300"
                    >
                      View on EAS
                    </a>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    FINISHED:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    IN_PROGRESS: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    IN_QUEUE:
      "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    NEW: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    ERRORED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    CANCELED:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  };
  const cls = map[status] ?? map.NEW;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {status.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}

function ApprovalPill({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString();
}
