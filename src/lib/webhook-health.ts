/**
 * Webhook health helpers — shared by dashboard server actions, the REST API,
 * and the scheduled dispatcher.
 *
 * `markWebhookInvalid` is the single place that transitions a webhook to
 * 'invalid' outside the health-check cron: it updates the status AND raises
 * a health alert, but only on the transition from a non-invalid status so
 * repeated failures don't spam the alerts table.
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { webhooks, webhookHealthAlerts } from "@/lib/schema";
import { logger } from "@/lib/logger";

export async function markWebhookInvalid(
  webhookId: string,
  reason: string,
): Promise<void> {
  try {
    const wh = await db
      .select({
        id: webhooks.id,
        userId: webhooks.userId,
        name: webhooks.name,
        lastStatus: webhooks.lastStatus,
      })
      .from(webhooks)
      .where(eq(webhooks.id, webhookId))
      .limit(1);
    if (wh.length === 0) return;

    // Already invalid — nothing to do, and no duplicate alert.
    if (wh[0].lastStatus === "invalid") return;

    await db
      .update(webhooks)
      .set({ lastStatus: "invalid" })
      .where(eq(webhooks.id, webhookId));

    // Same message shape as the health-check cron's "down" alert.
    await db.insert(webhookHealthAlerts).values({
      userId: wh[0].userId,
      webhookId: wh[0].id,
      type: "down",
      message: `Webhook "${wh[0].name}" tidak merespons (${reason})`,
    });
  } catch (e) {
    // Health bookkeeping must never break a send flow.
    logger.error(
      "webhook-health",
      "markWebhookInvalid failed",
      e instanceof Error ? e.message : e,
    );
  }
}
