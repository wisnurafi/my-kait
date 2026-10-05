/**
 * Admin notifications — Discord webhook pings for ops events.
 * Server-only. Never throws: a failed notification must never break
 * the user-facing flow. The webhook URL itself is never logged.
 */

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type NewReportNotice = {
  templateName: string;
  reporterName: string | null;
  reason: string;
};

export async function notifyAdminNewReport(
  notice: NewReportNotice,
  reviewUrl: string,
): Promise<void> {
  const url = env.ADMIN_NOTIFY_WEBHOOK_URL;
  if (!url) return;

  const reason =
    notice.reason.length > 400
      ? `${notice.reason.slice(0, 397)}...`
      : notice.reason;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `Tinjau laporan: ${reviewUrl}`,
        embeds: [
          {
            title: "🚩 Laporan template baru",
            color: 0xe5484d,
            fields: [
              { name: "Template", value: notice.templateName, inline: true },
              {
                name: "Pelapor",
                value: notice.reporterName ?? "Anonim",
                inline: true,
              },
              { name: "Alasan", value: reason },
            ],
            footer: { text: "My-Kait Admin" },
            timestamp: new Date().toISOString(),
          },
        ],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.error("admin-notify", `Discord webhook returned ${res.status}`);
    }
  } catch (err) {
    logger.error("admin-notify", "failed to send", err);
  }
}
