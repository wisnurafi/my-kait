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
 *     Suspended users are excluded from the claim.
 *  3. Sends each claim in small parallel batches with a 45s time budget,
 *     logs to message_logs (source='scheduled'). Each row is isolated: a
 *     delivered message is always marked 'sent' even if log persistence
 *     throws (never re-queued as a duplicate); unprocessed claims go back
 *     to pending for the next tick.
 *  4. Rate-limited sends go back to pending for the next tick (max 3 attempts);
 *     other failures are marked failed with the error recorded.
 */

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, sql } from "@/lib/db";
import { webhooks, messageLogs, scheduledMessages } from "@/lib/schema";
import { decryptWebhookUrl, encryptWebhookUrl } from "@/lib/crypto";
import { sendWebhookMessage } from "@/lib/discord";
import { markWebhookInvalid } from "@/lib/webhook-health";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/server/admin-password";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Rows claimed per tick — keeps each run well inside Hobby time limits. */
const MAX_PER_TICK = 15;
/** Rate-limited sends are retried on later ticks up to this many attempts. */
const MAX_ATTEMPTS = 3;
/** A 'sending' claim older than this is considered orphaned and re-queued. */
const STALE_CLAIM_MINUTES = 10;
/**
 * Stop starting new sends after this long so the tick always finishes inside
 * maxDuration. Claims we never get to are released back to pending for the
 * next tick (not left to the 10-minute stale-claim window).
 */
const TICK_BUDGET_MS = 45_000;
/**
 * Concurrent Discord sends per batch. Sequential sends let one slow webhook
 * (15s timeout each) stall the whole tick past maxDuration.
 */
const SEND_CONCURRENCY = 5;

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

type RowOutcome = "sent" | "failed" | "retried";

/**
 * Process one claimed row. Never throws: every failure path marks the row
 * explicitly so one bad row can't abort the whole tick.
 *
 * HARD RULE — if Discord already accepted the message, the row is marked
 * 'sent' even when log persistence or webhook bookkeeping throws. A row
 * stuck in 'sending' would be re-sent by the stale-claim re-queue (the
 * double-send incident class).
 */
async function processRow(row: ClaimedRow): Promise<RowOutcome> {
  let url: string;
  let webhookId: string | null = null;

  // 1. Resolve the target URL. Nothing has been sent yet, so failing the
  //    row here is safe.
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
        return "failed";
      }
      if (wh[0].lastStatus === "invalid") {
        await markRow(row.id, { status: "failed", lastError: "Webhook marked invalid" });
        return "failed";
      }
      url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
      webhookId = wh[0].id;
    } else if (row.manual_url_encrypted) {
      url = decryptWebhookUrl(row.manual_url_encrypted, row.manual_url_key_version ?? "");
    } else {
      await markRow(row.id, { status: "failed", lastError: "No target" });
      return "failed";
    }
  } catch (e) {
    await markRow(row.id, {
      status: "failed",
      lastError: e instanceof Error ? e.message : "Decrypt failed",
    });
    return "failed";
  }

  // 2. Send.
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

  // 3. Best-effort bookkeeping. Once the message was delivered, none of this
  //    may change the row outcome or leave it stuck in 'sending'.
  let logId: string | undefined;
  try {
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
    logId = log?.id;
  } catch (e) {
    logger.error(
      "cron",
      "dispatch-scheduled: message log insert failed (message was delivered)",
      e instanceof Error ? e.message : e,
    );
  }

  if (webhookId) {
    try {
      await db
        .update(webhooks)
        .set({ lastUsedAt: new Date() })
        .where(eq(webhooks.id, webhookId));
      if (result.httpStatus === 404 || result.httpStatus === 401) {
        await markWebhookInvalid(webhookId, `Discord HTTP ${result.httpStatus}`);
      }
    } catch (e) {
      logger.error(
        "cron",
        "dispatch-scheduled: webhook bookkeeping failed",
        e instanceof Error ? e.message : e,
      );
    }
  }

  // 4. Finalize the row. If even this throws (DB down), the row stays
  //    'sending' and the stale-claim re-queue recovers it — a last resort
  //    that only matters when the database itself is unreachable.
  try {
    if (result.success) {
      await markRow(row.id, { status: "sent", sentLogId: logId });
      return "sent";
    } else if (result.rateLimited && row.attempts < MAX_ATTEMPTS) {
      await markRow(row.id, { status: "pending", lastError: result.error });
      return "retried";
    } else {
      await markRow(row.id, { status: "failed", lastError: result.error });
      return "failed";
    }
  } catch (e) {
    logger.error(
      "cron",
      "dispatch-scheduled: markRow failed",
      e instanceof Error ? e.message : e,
    );
    return result.success ? "sent" : "failed";
  }
}

export async function GET(req: Request) {
  // Verify secret — strict "Bearer <secret>" format, timing-safe comparison.
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : "";
  if (!safeEqual(providedSecret, env.CRON_SECRET)) {
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

    // 2. Atomically claim due rows. Suspended users are excluded: their
    //    schedules must never be delivered.
    const claimed = (await sql`
      UPDATE scheduled_messages
      SET status = 'sending',
          claimed_at = NOW(),
          attempts = attempts + 1
      WHERE id IN (
        SELECT id FROM scheduled_messages
        WHERE status = 'pending' AND scheduled_at <= NOW()
          AND user_id IN (SELECT id FROM users WHERE is_suspended = false)
        ORDER BY scheduled_at ASC
        LIMIT ${MAX_PER_TICK}
      )
      RETURNING id, user_id, webhook_id, manual_url_encrypted,
                manual_url_key_version, webhook_name_snapshot,
                payload, mode, attempts
    `) as unknown as ClaimedRow[];

    // 3. Send claims in small parallel batches with a time budget, so one
    //    slow webhook can't stall the whole tick past maxDuration.
    const tickStart = Date.now();
    let sent = 0;
    let failed = 0;
    let retried = 0;
    const processed = new Set<string>();

    for (let i = 0; i < claimed.length; i += SEND_CONCURRENCY) {
      if (Date.now() - tickStart > TICK_BUDGET_MS) break;
      const batch = claimed.slice(i, i + SEND_CONCURRENCY);
      const outcomes = await Promise.allSettled(batch.map((row) => processRow(row)));
      outcomes.forEach((o, idx) => {
        processed.add(batch[idx].id);
        if (o.status === "fulfilled") {
          if (o.value === "sent") sent++;
          else if (o.value === "retried") retried++;
          else failed++;
        } else {
          // Unreachable in practice (processRow never throws). Counted as
          // failed; the row stays 'sending' for the stale-claim re-queue.
          logger.error(
            "cron",
            "dispatch-scheduled: processRow threw unexpectedly",
            o.reason instanceof Error ? o.reason.message : o.reason,
          );
          failed++;
        }
      });
    }

    // 4. Release claims we never got to back to pending, so the next tick
    //    picks them up immediately instead of the 10-minute stale window.
    const unprocessed = claimed.map((r) => r.id).filter((id) => !processed.has(id));
    if (unprocessed.length > 0) {
      await sql`
        UPDATE scheduled_messages
        SET status = 'pending', claimed_at = NULL
        WHERE id = ANY(${unprocessed})
      `;
    }

    return NextResponse.json({ ok: true, claimed: claimed.length, sent, failed, retried });
  } catch (e) {
    logger.error("cron", "dispatch-scheduled failed", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Dispatch failed" }, { status: 500 });
  }
}
