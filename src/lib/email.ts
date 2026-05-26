import { Resend } from "resend";

type SendInviteArgs = {
  to: string;
  orgName: string;
  inviterName: string | null;
  link: string;
};

export async function sendInviteEmail({ to, orgName, inviterName, link }: SendInviteArgs) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "EAS Dashboard <onboarding@example.com>";

  if (!apiKey) {
    // Dev fallback — surface the link so you can hand it off manually.
    console.log(`[invite] no RESEND_API_KEY; would email ${to}`);
    console.log(`[invite] ${link}`);
    return { sent: false as const };
  }

  const resend = new Resend(apiKey);
  const who = inviterName ?? "Someone";
  await resend.emails.send({
    from,
    to,
    subject: `Join ${orgName} on EAS Dashboard`,
    html: `
      <p>${who} invited you to join <strong>${escapeHtml(orgName)}</strong> on EAS Dashboard.</p>
      <p><a href="${link}">Accept the invite</a></p>
      <p style="color:#888;font-size:12px">If you weren't expecting this, you can ignore the email.</p>
    `,
  });
  return { sent: true as const };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
