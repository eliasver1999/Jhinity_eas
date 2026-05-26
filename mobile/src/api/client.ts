// Lightweight typed wrapper around fetch. All API calls go through here so
// auth headers + base URL stay centralized.

export type Me = {
  user: { id: string; name: string | null; email: string | null };
  org: { id: string; name: string; slug: string; role: "owner" | "admin" | "member" };
};

export type Build = {
  id: string;
  platform: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  appName: string | null;
  appSlug: string | null;
  buildProfile: string | null;
  gitCommitHash: string | null;
  gitCommitMessage: string | null;
  initiatingActor: string | null;
  easUrl: string | null;
  approval: { id: string; status: string } | null;
};

export type BuildsResponse = {
  easConnected: boolean;
  expoAccountName?: string;
  builds: Build[];
  error?: string;
};

export type ApprovalRequest = {
  id: string;
  buildId: string;
  buildProfile: string;
  appName: string | null;
  appSlug: string | null;
  platform: string | null;
  gitCommitHash: string | null;
  gitCommitMessage: string | null;
  initiatingActor: string | null;
  status: "pending" | "approved" | "rejected";
  approvalCount: number;
  requiredApprovals: number;
  createdAt: string;
  updatedAt: string;
};

export type ApprovalEvent = {
  id: string;
  type: "created" | "approved" | "rejected" | "comment";
  comment: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userId: string | null;
};

export type ApprovalDetail = {
  request: ApprovalRequest;
  events: ApprovalEvent[];
  easBuildUrl: string | null;
  policy: { approverRole: string; requiredApprovals: number } | null;
  canDecide: boolean;
  alreadyDecided: boolean;
};

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  token: string,
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(baseUrl + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  me: (token: string, baseUrl: string) =>
    request<Me>(token, baseUrl, "/api/me"),
  builds: (token: string, baseUrl: string) =>
    request<BuildsResponse>(token, baseUrl, "/api/builds"),
  approvals: (token: string, baseUrl: string, status: string) =>
    request<{ approvals: ApprovalRequest[] }>(
      token,
      baseUrl,
      `/api/approvals?status=${encodeURIComponent(status)}`,
    ),
  approval: (token: string, baseUrl: string, id: string) =>
    request<ApprovalDetail>(token, baseUrl, `/api/approvals/${id}`),
  approve: (token: string, baseUrl: string, id: string, comment: string | undefined) =>
    request<{ ok: true; status: string; approvalCount: number; requiredApprovals: number }>(
      token,
      baseUrl,
      `/api/approvals/${id}/approve`,
      { method: "POST", body: JSON.stringify({ comment }) },
    ),
  reject: (token: string, baseUrl: string, id: string, comment: string | undefined) =>
    request<{ ok: true; status: string }>(
      token,
      baseUrl,
      `/api/approvals/${id}/reject`,
      { method: "POST", body: JSON.stringify({ comment }) },
    ),
};

export { ApiError };
