// Lightweight client for Expo's GraphQL API.
//
// Schema details (field names on builds, etc.) come from the public eas-cli
// usage and may evolve. Both functions throw on HTTP or GraphQL errors so
// callers can surface a sane message to the user.

const EAS_GRAPHQL = "https://api.expo.dev/graphql";

export type EasActor = {
  id: string;
  type: "User" | "Robot";
  displayName: string;
  accounts: { id: string; name: string }[];
};

export type EasBuildStatus =
  | "NEW"
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "FINISHED"
  | "ERRORED"
  | "CANCELED"
  | string;

export type EasBuild = {
  id: string;
  platform: "ANDROID" | "IOS" | string;
  status: EasBuildStatus;
  createdAt: string;
  completedAt: string | null;
  appName: string | null;
  appSlug: string | null;
  buildProfile: string | null;
  gitCommitHash: string | null;
  gitCommitMessage: string | null;
  artifactUrl: string | null;
  initiatingActor: string | null;
  // Set by the caller (dashboard) once we know the account name —
  // points at expo.dev's build detail page, which never 404s on artifact GC.
  easUrl?: string | null;
};

async function easFetch<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(EAS_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as
    | { data?: T; errors?: { message?: string }[] }
    | null;

  if (!res.ok) {
    const reason = body?.errors?.[0]?.message ?? `${res.status} ${res.statusText}`;
    throw new EasError(reason, res.status);
  }
  if (body?.errors?.length) {
    throw new EasError(body.errors[0].message ?? "EAS GraphQL error", res.status);
  }
  if (!body?.data) throw new EasError("EAS returned an empty response", res.status);
  return body.data;
}

export class EasError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const ME_QUERY = /* GraphQL */ `
  query Me {
    meActor {
      id
      __typename
      ... on User {
        username
        accounts {
          id
          name
        }
      }
      ... on Robot {
        firstName
        accounts {
          id
          name
        }
      }
    }
  }
`;

type MeResponse = {
  meActor:
    | (
        | { __typename: "User"; id: string; username: string; accounts: { id: string; name: string }[] }
        | { __typename: "Robot"; id: string; firstName: string; accounts: { id: string; name: string }[] }
      )
    | null;
};

export async function fetchMeActor(token: string): Promise<EasActor> {
  const data = await easFetch<MeResponse>(token, ME_QUERY);
  const a = data.meActor;
  if (!a) throw new EasError("This token is not authorized", 401);
  return {
    id: a.id,
    type: a.__typename === "Robot" ? "Robot" : "User",
    displayName: a.__typename === "Robot" ? a.firstName : a.username,
    accounts: a.accounts ?? [],
  };
}

// Builds hang off App in Expo's schema, not Account. We query the account's
// apps and pull each app's most recent builds, then flatten + sort in code.
const BUILDS_QUERY = /* GraphQL */ `
  query AccountBuilds(
    $accountName: String!
    $appLimit: Int!
    $appOffset: Int!
    $buildLimit: Int!
    $buildOffset: Int!
  ) {
    account {
      byName(accountName: $accountName) {
        id
        name
        apps(limit: $appLimit, offset: $appOffset) {
          id
          name
          slug
          builds(limit: $buildLimit, offset: $buildOffset) {
            id
            platform
            status
            createdAt
            completedAt
            buildProfile
            gitCommitHash
            gitCommitMessage
            artifacts {
              buildUrl
            }
            initiatingActor {
              __typename
              ... on User {
                username
              }
              ... on Robot {
                firstName
              }
            }
          }
        }
      }
    }
  }
`;

type BuildsResponse = {
  account: {
    byName: {
      id: string;
      name: string;
      apps: Array<{
        id: string;
        name: string | null;
        slug: string | null;
        builds: Array<{
          id: string;
          platform: string;
          status: string;
          createdAt: string;
          completedAt: string | null;
          buildProfile: string | null;
          gitCommitHash: string | null;
          gitCommitMessage: string | null;
          artifacts: { buildUrl: string | null } | null;
          initiatingActor:
            | { __typename: "User"; username: string }
            | { __typename: "Robot"; firstName: string }
            | null;
        }>;
      }>;
    } | null;
  } | null;
};

export async function fetchRecentBuilds(
  token: string,
  accountName: string,
  limit = 25,
): Promise<EasBuild[]> {
  // Pull last 10 builds per app from up to 50 apps. For a typical team this
  // is one API call returning <=500 builds, easily covering the dashboard.
  const data = await easFetch<BuildsResponse>(token, BUILDS_QUERY, {
    accountName,
    appLimit: 50,
    appOffset: 0,
    buildLimit: 10,
    buildOffset: 0,
  });
  const apps = data.account?.byName?.apps ?? [];
  const flattened = apps.flatMap((app) =>
    app.builds.map((b) => ({
      id: b.id,
      platform: b.platform,
      status: b.status,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
      appName: app.name,
      appSlug: app.slug,
      buildProfile: b.buildProfile ?? null,
      gitCommitHash: b.gitCommitHash ?? null,
      gitCommitMessage: b.gitCommitMessage ?? null,
      artifactUrl: b.artifacts?.buildUrl ?? null,
      initiatingActor:
        b.initiatingActor?.__typename === "Robot"
          ? b.initiatingActor.firstName
          : b.initiatingActor?.__typename === "User"
            ? b.initiatingActor.username
            : null,
    })),
  );
  flattened.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return flattened.slice(0, limit);
}
