// Generic chat-webhook client. Slack and Discord both accept JSON via incoming
// webhooks; only the payload schema differs, so we dispatch on provider when
// building messages and use one POST function for both.

import type { ChatProvider } from "@/db/schema";

export class ChatError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function providerLabel(provider: ChatProvider): string {
  return provider === "slack" ? "Slack" : "Discord";
}

export function webhookUrlExample(provider: ChatProvider): string {
  return provider === "slack"
    ? "https://hooks.slack.com/services/..."
    : "https://discord.com/api/webhooks/...";
}

export function webhookInstructions(provider: ChatProvider): string {
  return provider === "slack"
    ? "In Slack: Apps → Incoming Webhooks → Add to channel. Paste the URL."
    : "In Discord: Server Settings → Integrations → Webhooks → New Webhook → Copy URL.";
}

export function isValidWebhookUrl(provider: ChatProvider, url: string): boolean {
  const trimmed = url.trim();
  if (provider === "slack") {
    return /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+$/.test(trimmed);
  }
  return /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+$/.test(
    trimmed,
  );
}

export async function postChatWebhook(
  url: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ChatError(
      body ? `${res.status}: ${body.slice(0, 200)}` : `${res.status} ${res.statusText}`,
      res.status,
    );
  }
}

// ---- Messages --------------------------------------------------------------

export type ApprovalMessageInput = {
  approvalRequestId: string;
  orgName: string;
  appName: string | null;
  appSlug: string | null;
  buildProfile: string;
  platform: string | null;
  gitCommitHash: string | null;
  gitCommitMessage: string | null;
  initiatingActor: string | null;
  required: number;
  appUrl: string;
};

export function buildApprovalMessage(
  provider: ChatProvider,
  input: ApprovalMessageInput,
): Record<string, unknown> {
  const project = input.appName ?? input.appSlug ?? "Untitled project";
  const reviewUrl = `${input.appUrl}/approvals/${input.approvalRequestId}`;
  const commitShort = input.gitCommitHash ? input.gitCommitHash.slice(0, 7) : null;
  const commitMsg = input.gitCommitMessage
    ? truncate(input.gitCommitMessage.split("\n")[0], 80)
    : null;

  if (provider === "slack") {
    const commitLine = commitShort
      ? `\`${commitShort}\`${commitMsg ? ` — ${commitMsg}` : ""}`
      : "_no commit info_";
    return {
      text: `Approval needed: ${project} · ${input.buildProfile}`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `🛎️  Approval needed — ${project}` },
        },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Profile*\n\`${input.buildProfile}\`` },
            { type: "mrkdwn", text: `*Platform*\n${(input.platform ?? "—").toLowerCase()}` },
            {
              type: "mrkdwn",
              text: `*Required*\n${input.required} approval${input.required === 1 ? "" : "s"}`,
            },
            { type: "mrkdwn", text: `*Initiated by*\n${input.initiatingActor ?? "—"}` },
          ],
        },
        { type: "section", text: { type: "mrkdwn", text: `*Commit*\n${commitLine}` } },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Review on EAS Dashboard" },
              url: reviewUrl,
              style: "primary",
            },
          ],
        },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `_${input.orgName} — EAS Dashboard_` }],
        },
      ],
    };
  }

  // Discord
  const commitLine = commitShort
    ? `\`${commitShort}\`${commitMsg ? ` — ${commitMsg}` : ""}`
    : "_no commit info_";
  return {
    username: "EAS Dashboard",
    embeds: [
      {
        title: `🛎️ Approval needed — ${project}`,
        url: reviewUrl,
        color: 0xfbbf24, // amber
        fields: [
          { name: "Profile", value: `\`${input.buildProfile}\``, inline: true },
          { name: "Platform", value: (input.platform ?? "—").toLowerCase(), inline: true },
          {
            name: "Required",
            value: `${input.required} approval${input.required === 1 ? "" : "s"}`,
            inline: true,
          },
          { name: "Initiated by", value: input.initiatingActor ?? "—", inline: true },
          { name: "Commit", value: commitLine, inline: false },
          {
            name: "​",
            value: `[Review on EAS Dashboard](${reviewUrl})`,
            inline: false,
          },
        ],
        footer: { text: `${input.orgName} — EAS Dashboard` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export type DecisionMessageInput = {
  approvalRequestId: string;
  orgName: string;
  appName: string | null;
  appSlug: string | null;
  buildProfile: string;
  platform: string | null;
  gitCommitHash: string | null;
  gitCommitMessage: string | null;
  decidedBy: string; // display name or email
  comment: string | null;
  approvalCount: number;
  requiredApprovals: number;
  appUrl: string;
};

export function buildDecisionMessage(
  provider: ChatProvider,
  input: DecisionMessageInput,
  status: "approved" | "rejected",
): Record<string, unknown> {
  const project = input.appName ?? input.appSlug ?? "Untitled project";
  const reviewUrl = `${input.appUrl}/approvals/${input.approvalRequestId}`;
  const commitShort = input.gitCommitHash ? input.gitCommitHash.slice(0, 7) : null;
  const commitMsg = input.gitCommitMessage
    ? truncate(input.gitCommitMessage.split("\n")[0], 80)
    : null;

  const headline =
    status === "approved"
      ? `:white_check_mark: Approved — ${project}`
      : `:x: Rejected — ${project}`;
  const headlinePlain =
    status === "approved" ? `✅ Approved — ${project}` : `❌ Rejected — ${project}`;
  const summary =
    status === "approved"
      ? `*${input.decidedBy}* gave the final approval (${input.approvalCount} of ${input.requiredApprovals}).`
      : `*${input.decidedBy}* rejected the release.`;

  if (provider === "slack") {
    const blocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: { type: "plain_text", text: headlinePlain, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: summary },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Profile*\n\`${input.buildProfile}\`` },
          { type: "mrkdwn", text: `*Platform*\n${(input.platform ?? "—").toLowerCase()}` },
        ],
      },
    ];
    if (commitShort) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Commit*\n\`${commitShort}\`${commitMsg ? ` — ${commitMsg}` : ""}`,
        },
      });
    }
    if (input.comment) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Comment*\n>${escapeMrkdwn(input.comment)}` },
      });
    }
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open on EAS Dashboard" },
          url: reviewUrl,
        },
      ],
    });
    blocks.push({
      type: "context",
      elements: [{ type: "mrkdwn", text: `_${input.orgName} — EAS Dashboard_` }],
    });
    return { text: `${headlinePlain}: ${input.decidedBy}`, blocks };
  }

  // Discord
  const fields: Array<Record<string, unknown>> = [
    { name: "Profile", value: `\`${input.buildProfile}\``, inline: true },
    { name: "Platform", value: (input.platform ?? "—").toLowerCase(), inline: true },
    {
      name: status === "approved" ? "Approved by" : "Rejected by",
      value: input.decidedBy,
      inline: true,
    },
  ];
  if (commitShort) {
    fields.push({
      name: "Commit",
      value: `\`${commitShort}\`${commitMsg ? ` — ${commitMsg}` : ""}`,
      inline: false,
    });
  }
  if (input.comment) {
    fields.push({
      name: "Comment",
      value: truncate(input.comment, 1000),
      inline: false,
    });
  }
  fields.push({
    name: "​",
    value: `[Open on EAS Dashboard](${reviewUrl})`,
    inline: false,
  });

  return {
    username: "EAS Dashboard",
    embeds: [
      {
        title: headline.replace(/:[a-z_]+:/g, "").trim(), // strip slack emoji shortcodes
        url: reviewUrl,
        description: summary.replace(/\*/g, "**"),
        color: status === "approved" ? 0x10b981 : 0xef4444,
        fields,
        footer: { text: `${input.orgName} — EAS Dashboard` },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

function escapeMrkdwn(s: string): string {
  return s.replace(/\n/g, "\n>").slice(0, 1500);
}

export function buildTestMessage(
  provider: ChatProvider,
  orgName: string,
): Record<string, unknown> {
  if (provider === "slack") {
    return {
      text: `EAS Dashboard is now connected to this channel for ${orgName}.`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: *EAS Dashboard* is connected to this channel for *${orgName}*. Pending approval requests will be posted here.`,
          },
        },
      ],
    };
  }
  return {
    username: "EAS Dashboard",
    embeds: [
      {
        title: "✅ Connected",
        description: `**EAS Dashboard** is connected to this channel for **${orgName}**. Pending approval requests will be posted here.`,
        color: 0x10b981, // emerald
      },
    ],
  };
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}
