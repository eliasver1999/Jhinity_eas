import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { invitations, memberships, users } from "@/db/schema";
import { getActiveOrg } from "@/lib/org";
import { inviteMemberAction, revokeInviteAction } from "@/actions/invites";

export default async function TeamPage() {
  const org = (await getActiveOrg())!;

  const members = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      role: memberships.role,
      joinedAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.organizationId, org.id))
    .orderBy(asc(memberships.createdAt));

  const pending = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(eq(invitations.organizationId, org.id))
    .orderBy(asc(invitations.createdAt));

  const canInvite = org.role === "owner" || org.role === "admin";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Manage members of {org.name}.
        </p>
      </div>

      {canInvite && (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
          <h2 className="text-sm font-medium">Invite a teammate</h2>
          <form
            action={inviteMemberAction}
            className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs text-neutral-600 dark:text-neutral-400">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="teammate@company.com"
                className="mt-1 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-600 dark:text-neutral-400">Role</label>
              <select
                name="role"
                defaultValue="member"
                className="mt-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Send invite
            </button>
          </form>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">Members ({members.length})</h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
              <tr>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="px-4 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
              {members.map((m) => (
                <tr key={m.userId}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name ?? m.email}</div>
                    {m.name && (
                      <div className="text-xs text-neutral-500">{m.email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-neutral-600 dark:text-neutral-400">
                    {m.role}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {m.joinedAt.toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium">Pending invitations ({pending.length})</h2>
          <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500 dark:bg-neutral-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Email</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Expires</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white dark:divide-neutral-800 dark:bg-neutral-950">
                {pending.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-3">{i.email}</td>
                    <td className="px-4 py-3 capitalize text-neutral-600 dark:text-neutral-400">
                      {i.role}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {i.expiresAt.toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canInvite && (
                        <form action={revokeInviteAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <button
                            type="submit"
                            className="text-xs text-neutral-500 hover:text-red-600"
                          >
                            Revoke
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
