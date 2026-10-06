/**
 * Scheduled message dispatcher.
 * Triggered every minute by cron-job.org (separate job from health-check).
 * Protected by CRON_SECRET. Trigger: GET /api/cron/dispatch-scheduled
 *
 * Each tick:
 *  1. Re-queues stale 'sending' rows (claimed > 10 min ago — previous tick died).
 *  2. Atomically claims due rows (pending -> sending) so overlapping ticks
 *     can never send a duplicate. No transaction needed: the UPDATE..RETURNING
 *     is a single atomic statement (Neon HTTP driver has no db.transaction).
 *  3. Sends each claim, logs to message_logs (source='scheduled').
 *  4. Rate-limited sends go back to pending for the next tick (max 3 attempts);
 *     other failures are marked failed with the error recorded.
 */

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, sql } from "@/lib/db";
import { webhooks, messageLogs, scheduledMessages } from "@/lib/schema";
import { decryptWebhookUrl, encryptWebhookUrl } from "@/lib/crypto";
import { sendWebhookMessage } from "@/lib/discord";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rows claimed per tick — keeps each run well inside Hobby time limits. */
const MAX_PER_TICK = 15;
/** Rate-limited sends are retried on later ticks up to this many attempts. */
const MAX_ATTEMPTS = 3;
/** A 'sending' claim older than this is considered orphaned and re-queued. */
const STALE_CLAIM_MINUTES = 10;

interface ClaimedRow {
  id: string;
  user_id: string;
  webhook_id: string | null;
  manual_url_encrypted: string | null;
  manual_url_key_version: string | null;
  webhook_name_snapshot: string;
  payload: unknown;
  mode: "normal" | "embed" | "both";
  attempts: number;
}

async function markRow(
  id: string,
  patch: { status: "sent" | "failed" | "pending"; lastError?: string | null; sentLogId?: string },
) {
  await sql`
    UPDATE scheduled_messages
    SET status = ${patch.status},
        claimed_at = NULL,
        last_error = ${patch.lastError ?? null},
        sent_log_id = ${patch.sentLogId ?? null}
    WHERE id = ${id}
  `;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "");
  if (providedSecret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Re-queue orphaned claims from died ticks
    const staleBefore = new Date(Date.now() - STALE_CLAIM_MINUTES * 60_000);
    await sql`
      UPDATE scheduled_messages
      SET status = 'pending', claimed_at = NULL
      WHERE status = 'sending'
        AND claimed_at < ${staleBefore.toISOString()}
    `;

    // 2. Atomically claim due rows
    const claimed = (await sql`
      UPDATE scheduled_messages
      SET status = 'sending',
          claimed_at = NOW(),
          attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM scheduled_messages
        WHERE status = 'pending' AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT ${MAX_PER_TICK}
      )
      RETURNING id, user_id, webhook_id, manual_url_encrypted,
                manual_url_key_version, webhook_name_snapshot,
                payload, mode, attempts
    `) as unknown as ClaimedRow[];

    let sent = 0;
    let failed = 0;
    let retried = 0;

    // 3. Send each claim
    for (const row of claimed) {
      let url: string;
      let webhookId: string | null = null;

      try {
        if (row.webhook_id) {
          const wh = await db
            .select()
            .from(webhooks)
            .where(
              and(
                eq(webhooks.id, row.webhook_id),
                eq(webhooks.userId, row.user_id),
              ),
            )
            .limit(1);
          if (wh.length === 0) {
            await markRow(row.id, { status: "failed", lastError: "Webhook deleted" });
            failed++;
            continue;
          }
          if (wh[0].lastStatus === "invalid") {
            await markRow(row.id, { status: "failed", lastError: "Webhook marked invalid" });
            failed++;
            continue;
          }
          url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
          webhookId = wh[0].id;
        } else if (row.manual_url_encrypted) {
          url = decryptWebhookUrl(row.manual_url_encrypted, row.manual_url_key_version ?? "");
        } else {
          await markRow(row.id, { status: "failed", lastError: "No target" });
          failed++;
          continue;
        }
      } catch (e) {
        await markRow(row.id, {
          status: "failed",
          lastError: e instanceof Error ? e.message : "Decrypt failed",
        });
        failed++;
        continue;
      }

      const start = Date.now();
      const result = await sendWebhookMessage(url, row.payload as Record<string, unknown>);
      const latencyMs = Date.now() - start;
      const status = result.success
        ? "sent"
        : result.rateLimited
          ? "rate_limited"
          : "failed";

      // Manual-URL schedules store the encrypted URL like the dashboard does
      let manualUrlEncrypted: string | null = null;
      let manualUrlKeyVersion: string | null = null;
      if (!webhookId) {
        const enc = encryptWebhookUrl(url);
        manualUrlEncrypted = enc.encrypted;
        manualUrlKeyVersion = enc.keyVersion;
      }

      const [log] = await db
        .insert(messageLogs)
        .values({
          userId: row.user_id,
          webhookId,
          webhookNameSnapshot: row.webhook_name_snapshot,
          manualUrlEncrypted,
          manualUrlKeyVersion,
          mode: row.mode,
          payload: row.payload as Record<string, unknown>,
          status,
          httpStatus: result.httpStatus,
          latencyMs,
          discordMessageId: result.messageId,
          error: result.error,
          source: "scheduled",
        })
        .returning({ id: messageLogs.id });

      if (webhookId) {
        await db
          .update(webhooks)
          .set({ lastUsedAt: new Date() })
          .where(eq(webhooks.id, webhookId));
        if (result.httpStatus === 404 || result.httpStatus === 401) {
          await db
            .update(webhooks)
            .set({ lastStatus: "invalid" })
            .where(eq(webhooks.id, webhookId));
        }
      }

      if (result.success) {
        await markRow(row.id, { status: "sent", sentLogId: log.id });
        sent++;
      } else if (result.rateLimited && row.attempts < MAX_ATTEMPTS) {
        await markRow(row.id, { status: "pending", lastError: result.error });
        retried++;
      } else {
        await markRow(row.id, { status: "failed", lastError: result.error });
        failed++;
      }
    }

    return NextResponse.json({ ok: true, claimed: claimed.length, sent, failed, retried });
  } catch (e) {
    logger.error("cron", "dispatch-scheduled failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}
