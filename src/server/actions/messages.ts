"use server";

/**
 * Message sending & logging server actions.
 * See PRD sections 3.4, 3.5, 3.8, 5.4, 6.3.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { webhooks, messageLogs, users } from "@/lib/schema";
import { eq, and, desc, gte, lte, ilike, sql, count, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { decryptWebhookUrl, encryptWebhookUrl } from "@/lib/crypto";
import {
  sendWebhookMessage,
  editWebhookMessage,
  deleteWebhookMessage,
  validateWebhookUrl,
} from "@/lib/discord";
import { list as listBlobs, del as deleteBlobs } from "@vercel/blob";
import { sendRequestSchema, sendPayloadSchema, logFilterSchema } from "@/lib/validations";
import type { LogFilter } from "@/lib/validations";
import { checkRateLimit } from "@/lib/ratelimit";
import { getActionT } from "@/server/i18n";
import { substitutePayloadVariables, parseCustomVars } from "@/lib/template-vars";
import { logger } from "@/lib/logger";
import { markWebhookInvalid } from "@/lib/webhook-health";
type MessageStatus = "sent" | "failed" | "rate_limited" | "edited" | "deleted";
type MessageMode = "normal" | "embed" | "both";

/* --- Send message --- */
export async function sendMessageAction(prevState: unknown, formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const rl = await checkRateLimit("send", user.id);
  if (!rl.success) {
    return { error: t("rateLimited") };
  }

  // Parse payload from formData
  const payloadStr = String(formData.get("payload") ?? "");
  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return { error: t("payloadInvalid") };
  }

  const mode = String(formData.get("mode") ?? "normal") as MessageMode;
  const webhookId = String(formData.get("webhookId") ?? "") || undefined;
  const manualUrl = String(formData.get("manualUrl") ?? "") || undefined;
  const savePayload = formData.get("savePayload") !== "false";
  const multiTargetRaw = String(formData.get("multiTarget") ?? "") || "";
  const multiTargetIds = multiTargetRaw ? multiTargetRaw.split(",").filter(Boolean) : [];
  const MAX_MULTI_TARGETS = 20;
  if (multiTargetIds.length > MAX_MULTI_TARGETS) {
    return { error: t("tooManyTargets") };
  }
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || undefined;

  // Custom template variables: {name} -> value pairs supplied by the user
  // in the send form. Validated strictly (see parseCustomVars);
  // malformed input is ignored.
  const customVars = parseCustomVars(String(formData.get("customVars") ?? ""));

  // Idempotency check: if this key was already processed, return cached result
  if (idempotencyKey) {
    const existing = await db
      .select()
      .from(messageLogs)
      .where(
        and(
          eq(messageLogs.userId, user.id),
          eq(messageLogs.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      const prev = existing[0];
      if (prev.status === "sent") {
        return {
          success: true,
          messageId: prev.discordMessageId ?? undefined,
          message: t("messageSentDuplicate"),
          deduplicated: true,
        };
      }
      return { error: prev.error ?? "Pengiriman sebelumnya gagal" };
    }
  }

  // Validate
  const parsed = sendRequestSchema(t).safeParse({
    webhookId,
    manualUrl,
    payload,
    mode,
    savePayload,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("payloadInvalid") };
  }

  // Determine which webhook URL(s) to use
  let url: string;
  let webhookRecord: { id: string; name: string } | null = null;
  
  // Multi-target: send to multiple webhooks
  if (multiTargetIds.length > 1) {
    const results: Array<{ id: string; name: string; success: boolean; messageId?: string; error?: string }> = [];
    let hitRateLimit = false;

    for (const targetId of multiTargetIds) {
      // Enforce the send quota per target: the check at the top of this
      // action only covers a single send, so consume one token per target.
      const targetRl = await checkRateLimit("send", user.id);
      if (!targetRl.success) {
        hitRateLimit = true;
        break;
      }

      const wh = await db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.id, targetId),
            eq(webhooks.userId, user.id),
          ),
        )
        .limit(1);

      if (wh.length === 0) continue;

      // Skip webhooks marked as invalid
      if (wh[0].lastStatus === "invalid") {
        results.push({ id: wh[0].id, name: wh[0].name, success: false, error: t("webhookInvalid") });
        continue;
      }

      // Per-target idempotency: if this attempt already logged this target
      // (e.g. a double-submitted batch), reuse the recorded outcome instead
      // of sending a duplicate message to Discord.
      const targetKey = idempotencyKey ? `${idempotencyKey}:${targetId}` : null;
      if (targetKey) {
        const prev = await db
          .select({
            status: messageLogs.status,
            discordMessageId: messageLogs.discordMessageId,
            error: messageLogs.error,
          })
          .from(messageLogs)
          .where(
            and(
              eq(messageLogs.userId, user.id),
              eq(messageLogs.idempotencyKey, targetKey),
            ),
          )
          .limit(1);
        if (prev.length > 0) {
          results.push({
            id: wh[0].id,
            name: wh[0].name,
            success: prev[0].status === "sent",
            messageId: prev[0].discordMessageId ?? undefined,
            error: prev[0].error ?? undefined,
          });
          continue;
        }
      }

      const targetUrl = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
      const processedPayload = substitutePayloadVariables(payload, customVars);
      const start = Date.now();
      const result = await sendWebhookMessage(targetUrl, processedPayload);
      const latencyMs = Date.now() - start;

      let status: MessageStatus;
      if (result.success) status = "sent";
      else if (result.rateLimited) status = "rate_limited";
      else status = "failed";

      // Best-effort log: a failed insert must not abort the remaining
      // targets — the message was already delivered to Discord.
      try {
        await db
          .insert(messageLogs)
          .values({
            userId: user.id,
            webhookId: wh[0].id,
            webhookNameSnapshot: wh[0].name,
            mode,
            payload: savePayload ? processedPayload : null,
            status,
            httpStatus: result.httpStatus,
            latencyMs,
            discordMessageId: result.messageId,
            error: result.error,
            source: "send",
            idempotencyKey: targetKey,
          })
          // Residual race guard: the pre-send check above covers retries, but
          // two truly concurrent requests can still collide here — skip the
          // duplicate log row instead of throwing a unique-violation 500.
          .onConflictDoNothing({
            target: [messageLogs.userId, messageLogs.idempotencyKey],
          });
      } catch (e) {
        logger.error("send", "message log insert failed", e instanceof Error ? e.message : e);
      }

      // Best-effort webhook bookkeeping — never aborts the batch.
      try {
        await db.update(webhooks).set({ lastUsedAt: new Date() }).where(eq(webhooks.id, wh[0].id));
        if (result.httpStatus === 404 || result.httpStatus === 401) {
          await markWebhookInvalid(wh[0].id, `Discord HTTP ${result.httpStatus}`);
        }
      } catch (e) {
        logger.error("send", "webhook bookkeeping failed", e instanceof Error ? e.message : e);
      }

      results.push({ id: wh[0].id, name: wh[0].name, success: result.success, messageId: result.messageId, error: result.error });
    }

    revalidatePath("/logs");
    if (hitRateLimit) {
      return { error: t("rateLimited"), results };
    }
    const successCount = results.filter((r) => r.success).length;
    if (successCount === 0) {
      return { error: t("allSendsFailed"), results };
    }
    return {
      success: true,
      message: `${successCount}/${results.length} pesan terkirim!`,
      results,
    };
  }

  // Single target
  if (parsed.data.webhookId) {
    const wh = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, parsed.data.webhookId),
          eq(webhooks.userId, user.id),
        ),
      )
      .limit(1);

    if (wh.length === 0) {
      return { error: t("webhookNotFound") };
    }

    url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
    webhookRecord = { id: wh[0].id, name: wh[0].name };

    // Check if webhook is valid
    if (wh[0].lastStatus === "invalid") {
      return { error: t("webhookMarkedInvalid") };
    }
  } else if (parsed.data.manualUrl) {
    const validation = validateWebhookUrl(parsed.data.manualUrl);
    if (!validation.valid) {
      return { error: t("webhookInvalid") };
    }
    url = parsed.data.manualUrl;
  } else {
    return { error: t("selectWebhookOrUrl") };
  }

  // Substitute template variables
  const processedPayload = substitutePayloadVariables(payload, customVars);

  // Send
  const start = Date.now();
  const result = await sendWebhookMessage(url, processedPayload);
  const latencyMs = Date.now() - start;

  // Determine status
  let status: MessageStatus;
  if (result.success) {
    status = "sent";
  } else if (result.rateLimited) {
    status = "rate_limited";
  } else {
    status = "failed";
  }

  // Log to database
  // For manual URL sends, encrypt and store the URL so edit/delete work later
  let manualUrlEncrypted: string | null = null;
  let manualUrlKeyVersion: string | null = null;
  if (!webhookRecord && url) {
    const enc = encryptWebhookUrl(url);
    manualUrlEncrypted = enc.encrypted;
    manualUrlKeyVersion = enc.keyVersion;
  }

  // Best-effort log: the message was already sent — a failed insert must
  // not fail the whole action (the 2026-10-02 incident class). The caller
  // is told via logPersisted so the UI doesn't mislead the user.
  let logPersisted = true;
  let inserted: Array<{ id: string }> = [];
  try {
    inserted = await db
      .insert(messageLogs)
      .values({
        userId: user.id,
        webhookId: webhookRecord?.id ?? null,
        webhookNameSnapshot: webhookRecord?.name ?? "Manual URL",
        manualUrlEncrypted,
        manualUrlKeyVersion,
        mode,
        payload: savePayload ? processedPayload : null,
        status,
        httpStatus: result.httpStatus,
        latencyMs,
        discordMessageId: result.messageId,
        error: result.error,
        source: "send",
        idempotencyKey: idempotencyKey ?? null,
      })
      // Race guard: the early check above and this insert are not atomic, so
      // two concurrent requests with the same key can both pass the check.
      // The loser skips its log row and returns the winner's outcome instead
      // of throwing a unique-violation 500.
      .onConflictDoNothing({
        target: [messageLogs.userId, messageLogs.idempotencyKey],
      })
      .returning({ id: messageLogs.id });
  } catch (e) {
    logger.error("send", "message log insert failed", e instanceof Error ? e.message : e);
    logPersisted = false;
  }

  // Only consult the race-recovery path when the insert actually ran: a
  // thrown insert means "unknown", not "lost a race".
  if (logPersisted && idempotencyKey && inserted.length === 0) {
    const prev = await db
      .select()
      .from(messageLogs)
      .where(
        and(
          eq(messageLogs.userId, user.id),
          eq(messageLogs.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    revalidatePath("/logs");
    if (prev.length > 0 && prev[0].status === "sent") {
      return {
        success: true,
        messageId: prev[0].discordMessageId ?? undefined,
        message: t("messageSentDuplicate"),
        deduplicated: true,
      };
    }
    return { error: prev[0]?.error ?? "Pengiriman sebelumnya gagal" };
  }

  // Update webhook lastUsedAt — best-effort, must not fail the action.
  if (webhookRecord) {
    try {
      await db
        .update(webhooks)
        .set({ lastUsedAt: new Date() })
        .where(eq(webhooks.id, webhookRecord.id));

      // Mark webhook invalid if 404/401 (with a health alert on transition)
      if (result.httpStatus === 404 || result.httpStatus === 401) {
        await markWebhookInvalid(webhookRecord.id, `Discord HTTP ${result.httpStatus}`);
      }
    } catch (e) {
      logger.error("send", "webhook bookkeeping failed", e instanceof Error ? e.message : e);
    }
  }

  revalidatePath("/logs");
  if (!result.success) {
    return { error: result.error ?? t("generic") };
  }
  return {
    success: true,
    messageId: result.messageId,
    message: t("messageSent"),
    logPersisted,
  };
}

/* --- Edit sent message --- */
export async function editMessageAction(prevState: unknown, formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const logId = String(formData.get("logId") ?? "");
  const payloadStr = String(formData.get("payload") ?? "");
  const overrideWebhookId = String(formData.get("webhookId") ?? "") || undefined;
  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return { error: t("payloadInvalid") };
  }

  // Validate like the send path does — an oversize/invalid payload should
  // be rejected here, not discovered via Discord's 400.
  const payloadCheck = sendPayloadSchema(t).safeParse(payload);
  if (!payloadCheck.success) {
    return {
      error: payloadCheck.error.issues[0]?.message ?? t("payloadInvalid"),
    };
  }
  payload = payloadCheck.data;

  // Get the log record
  const log = await db
    .select()
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.id, logId),
        eq(messageLogs.userId, user.id),
      ),
    )
    .limit(1);

  if (log.length === 0 || !log[0].discordMessageId) {
    return { error: t("messageNotEditable") };
  }

  // Determine webhook URL: saved webhook > stored manual URL > form override
  let url: string;
  let webhookName = "Manual URL";
  let effectiveWebhookId: string | null = log[0].webhookId;

  if (effectiveWebhookId) {
    // Get webhook URL from saved webhook
    const wh = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, effectiveWebhookId),
          eq(webhooks.userId, user.id),
        ),
      )
      .limit(1);

    if (wh.length === 0) {
      return { error: t("webhookNotFound") };
    }
    url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
    webhookName = wh[0].name;
  } else if (log[0].manualUrlEncrypted && log[0].manualUrlKeyVersion) {
    // Use stored manual URL (no need to select webhook)
    url = decryptWebhookUrl(log[0].manualUrlEncrypted, log[0].manualUrlKeyVersion);
  } else if (overrideWebhookId) {
    // Fallback: user selected a webhook in editor
    const wh = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, overrideWebhookId),
          eq(webhooks.userId, user.id),
        ),
      )
      .limit(1);

    if (wh.length === 0) {
      return { error: t("webhookNotFound") };
    }
    url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
    webhookName = wh[0].name;
    effectiveWebhookId = overrideWebhookId;
  } else {
    return { error: t("legacyNoUrlEdit") };
  }
  const result = await editWebhookMessage(url, log[0].discordMessageId, payload);

  // Log the edit
  // Copy manualUrlEncrypted so delete works via the edit log too
  await db.insert(messageLogs).values({
    userId: user.id,
    webhookId: effectiveWebhookId,
    webhookNameSnapshot: webhookName,
    manualUrlEncrypted: log[0].manualUrlEncrypted,
    manualUrlKeyVersion: log[0].manualUrlKeyVersion,
    mode: log[0].mode,
    payload,
    status: result.success ? "edited" : "failed",
    httpStatus: result.httpStatus,
    discordMessageId: log[0].discordMessageId,
    error: result.error,
    source: "edit",
  });

  if (!result.success) {
    return { error: result.error ?? "Gagal mengedit pesan" };
  }

  revalidatePath("/logs");
  return { success: true, message: t("messageEdited") };
}

/* --- Delete sent message --- */
export async function deleteMessageAction(prevState: unknown, formData: FormData) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const logId = String(formData.get("logId") ?? "");

  const log = await db
    .select()
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.id, logId),
        eq(messageLogs.userId, user.id),
      ),
    )
    .limit(1);

  if (log.length === 0 || !log[0].discordMessageId) {
    return { error: t("messageNotDeletable") };
  }

  // Determine webhook URL: saved webhook > stored manual URL
  let url: string;
  let webhookName = "Manual URL";
  let effectiveWebhookId: string | null = log[0].webhookId;

  if (effectiveWebhookId) {
    const wh = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, effectiveWebhookId),
          eq(webhooks.userId, user.id),
        ),
      )
      .limit(1);

    if (wh.length === 0) {
      return { error: t("webhookNotFound") };
    }
    url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
    webhookName = wh[0].name;
  } else if (log[0].manualUrlEncrypted && log[0].manualUrlKeyVersion) {
    // Use stored manual URL
    url = decryptWebhookUrl(log[0].manualUrlEncrypted, log[0].manualUrlKeyVersion);
  } else {
    return { error: t("legacyNoUrlDelete") };
  }
  const result = await deleteWebhookMessage(url, log[0].discordMessageId);

  await db.insert(messageLogs).values({
    userId: user.id,
    webhookId: effectiveWebhookId,
    webhookNameSnapshot: webhookName,
    manualUrlEncrypted: log[0].manualUrlEncrypted,
    manualUrlKeyVersion: log[0].manualUrlKeyVersion,
    mode: log[0].mode,
    status: result.success ? "deleted" : "failed",
    httpStatus: result.httpStatus,
    discordMessageId: log[0].discordMessageId,
    error: result.error,
    source: "delete",
  });

  if (!result.success) {
    return { error: result.error ?? "Gagal menghapus pesan" };
  }

  revalidatePath("/logs");
  return { success: true, message: t("messageDeleted") };
}

/* --- Resend a failed log to its original webhook --- */
export async function resendLogAction(logId: string) {
  const user = await requireAuth();
  const t = await getActionT("errors");

  // A resend is a send: it consumes the same quota.
  const rl = await checkRateLimit("send", user.id);
  if (!rl.success) {
    return { error: t("rateLimited") };
  }

  // Fetch the log and verify ownership (never resend another user's log).
  const rows = await db
    .select()
    .from(messageLogs)
    .where(and(eq(messageLogs.id, logId), eq(messageLogs.userId, user.id)))
    .limit(1);
  if (rows.length === 0) {
    return { error: t("logNotFound") };
  }
  const log = rows[0];

  // Without a saved payload there is nothing to resend.
  const payload = log.payload as Record<string, unknown> | null;
  if (!payload) {
    return { error: t("resendNoPayload") };
  }

  // Resolve the original target: saved webhook first, then manual URL.
  // (webhookId is set to null when the webhook is deleted.)
  let url: string | null = null;
  let webhookRecord: { id: string; name: string } | null = null;
  if (log.webhookId) {
    const wh = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, log.webhookId), eq(webhooks.userId, user.id)))
      .limit(1);
    if (wh.length > 0) {
      if (wh[0].lastStatus === "invalid") {
        return { error: t("webhookInvalid") };
      }
      webhookRecord = { id: wh[0].id, name: wh[0].name };
      url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
    }
  }
  if (!url && log.manualUrlEncrypted && log.manualUrlKeyVersion) {
    url = decryptWebhookUrl(log.manualUrlEncrypted, log.manualUrlKeyVersion);
  }
  if (!url) {
    // Original webhook is gone: let the client fall back to the editor
    // so the user can pick a new target.
    return { error: t("resendNoTarget"), code: "NO_TARGET" };
  }

  const start = Date.now();
  const result = await sendWebhookMessage(url, payload);
  const latencyMs = Date.now() - start;

  let status: MessageStatus;
  if (result.success) status = "sent";
  else if (result.rateLimited) status = "rate_limited";
  else status = "failed";

  // Best-effort log: the message was already sent — a failed insert must
  // not fail the whole action.
  let logPersisted = true;
  try {
    await db.insert(messageLogs).values({
      userId: user.id,
      webhookId: webhookRecord?.id ?? null,
      webhookNameSnapshot: webhookRecord?.name ?? log.webhookNameSnapshot,
      manualUrlEncrypted: webhookRecord ? null : log.manualUrlEncrypted,
      manualUrlKeyVersion: webhookRecord ? null : log.manualUrlKeyVersion,
      mode: log.mode as MessageMode,
      payload,
      status,
      httpStatus: result.httpStatus,
      latencyMs,
      discordMessageId: result.messageId,
      error: result.error,
      source: "resend",
    });
  } catch (e) {
    logger.error("send", "resend log insert failed", e instanceof Error ? e.message : e);
    logPersisted = false;
  }

  // Best-effort webhook bookkeeping — must not fail the action.
  if (webhookRecord) {
    try {
      await db
        .update(webhooks)
        .set({ lastUsedAt: new Date() })
        .where(eq(webhooks.id, webhookRecord.id));
      if (result.httpStatus === 404 || result.httpStatus === 401) {
        await markWebhookInvalid(webhookRecord.id, `Discord HTTP ${result.httpStatus}`);
      }
    } catch (e) {
      logger.error("send", "webhook bookkeeping failed", e instanceof Error ? e.message : e);
    }
  }

  revalidatePath("/logs");
  if (!result.success) {
    return { error: result.error ?? t("generic") };
  }
  return { success: true, messageId: result.messageId, message: t("messageResent"), logPersisted };
}

/** Shared filter builder for getLogs and the export action below. */
function buildLogFilterConditions(userId: string, v: Partial<LogFilter>) {
  const { status, webhookId, mode, source, search } = v;
  const { datePreset, dateFrom, dateTo } = v;

  const conditions = [eq(messageLogs.userId, userId)];

  if (status) {
    conditions.push(eq(messageLogs.status, status));
  }
  if (webhookId) {
    conditions.push(eq(messageLogs.webhookId, webhookId));
  }
  if (mode) {
    conditions.push(eq(messageLogs.mode, mode));
  }
  if (source) {
    conditions.push(eq(messageLogs.source, source));
  }

  // Date filtering
  const now = new Date();
  if (datePreset === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    conditions.push(gte(messageLogs.createdAt, startOfDay));
  } else if (datePreset === "7d") {
    conditions.push(gte(messageLogs.createdAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
  } else if (datePreset === "30d") {
    conditions.push(gte(messageLogs.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)));
  } else if (datePreset === "custom") {
    if (dateFrom) {
      conditions.push(gte(messageLogs.createdAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(messageLogs.createdAt, new Date(dateTo)));
    }
  }

  // Search
  if (search) {
    conditions.push(
      sql`(${messageLogs.webhookNameSnapshot} ILIKE ${`%${search}%`} OR CAST(${messageLogs.payload} AS TEXT) ILIKE ${`%${search}%`} OR ${messageLogs.discordMessageId} ILIKE ${`%${search}%`})`,
    );
  }

  return conditions;
}

/* --- Get logs with filters --- */
export async function getLogs(filters: {
  status?: string;
  webhookId?: string;
  mode?: string;
  source?: string;
  search?: string;
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}) {
  const user = await requireAuth();

  // Validate filter params: whitelists the status/mode/source/sort enums
  // and bounds page/perPage (perPage max 100) so a crafted query string
  // can't exhaust memory. On invalid input fall back to safe defaults
  // instead of throwing — this runs inside server components.
  const v: Partial<LogFilter> = logFilterSchema.safeParse(filters).data ?? {};

  const conditions = buildLogFilterConditions(user.id, v);

  const sort = v.sort ?? "newest";
  const page = v.page ?? 1;
  // The schema default perPage is 20 but the logs UI uses 12 — keep 12 when
  // not provided; the schema already clamps an explicit value to ≤100.
  const perPage = filters.perPage == null ? 12 : (v.perPage ?? 12);

  const totalResult = await db
    .select({ total: count() })
    .from(messageLogs)
    .where(and(...conditions));

  const total = totalResult[0]?.total ?? 0;

  const logs = await db
    .select()
    .from(messageLogs)
    .where(and(...conditions))
    .orderBy(sort === "oldest" ? (messageLogs.createdAt as any) : desc(messageLogs.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);

  // Summary — delivery outcomes only. 'deleted' rows are an audit trail,
  // not delivery failures, so they're excluded from the success rate.
  const sentCount = await db
    .select({ total: count() })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.userId, user.id),
        inArray(messageLogs.status, ["sent", "edited"]),
      ),
    );
  const failedCount = await db
    .select({ total: count() })
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.userId, user.id),
        inArray(messageLogs.status, ["failed", "rate_limited"]),
      ),
    );

  const sentTotal = sentCount[0]?.total ?? 0;
  const failedTotal = failedCount[0]?.total ?? 0;
  const deliveredTotal = sentTotal + failedTotal;

  return {
    logs,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    summary: {
      sent: sentTotal,
      failed: failedTotal,
      successRate:
        deliveredTotal > 0 ? Math.round((sentTotal / deliveredTotal) * 100) : 0,
    },
  };
}

/* --- Get ALL filtered logs for export (no pagination, capped) ---
 * Same filter input type as getLogs (minus pagination). Returns at most
 * 5000 rows so a huge history can't exhaust memory — the UI should narrow
 * the filters for larger histories. Row shape matches getLogs.
 */
export async function getAllFilteredLogsAction(filters: {
  status?: string;
  webhookId?: string;
  mode?: string;
  source?: string;
  search?: string;
  datePreset?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
}) {
  const user = await requireAuth();

  const v: Partial<LogFilter> = logFilterSchema.safeParse(filters).data ?? {};
  const conditions = buildLogFilterConditions(user.id, v);
  const sort = v.sort ?? "newest";

  const logs = await db
    .select()
    .from(messageLogs)
    .where(and(...conditions))
    .orderBy(sort === "oldest" ? (messageLogs.createdAt as any) : desc(messageLogs.createdAt))
    .limit(5000);

  return { logs };
}

/* --- Get single log detail --- */
export async function getLogDetail(logId: string) {
  const user = await requireAuth();

  const log = await db
    .select()
    .from(messageLogs)
    .where(
      and(
        eq(messageLogs.id, logId),
        eq(messageLogs.userId, user.id),
      ),
    )
    .limit(1);

  return log[0] ?? null;
}

/* --- Delete all logs --- */
export async function clearLogsAction() {
  const user = await requireAuth();

  await db
    .delete(messageLogs)
    .where(eq(messageLogs.userId, user.id));

  revalidatePath("/logs");
  return { success: true };
}

/* --- Delete account --- */
export async function deleteAccountAction() {
  const user = await requireAuth();

  // Delete the user's uploaded blobs. Best-effort: blob storage being
  // unreachable must never block the database delete below.
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (token) {
      const prefix = `mykait/${user.id}/`;
      let cursor: string | undefined;
      do {
        const page = await listBlobs({ prefix, token, cursor });
        if (page.blobs.length > 0) {
          await deleteBlobs(
            page.blobs.map((b) => b.url),
            { token },
          );
        }
        cursor = page.cursor;
      } while (cursor);
    }
  } catch {
    // Ignored: the database delete below is authoritative.
  }

  // Delete the user row itself. Every user-owned table references users.id
  // with onDelete: "cascade" (webhooks, templates, template folders, message
  // logs, webhook health alerts; shares and reports cascade via templates),
  // so this single statement removes all of the user's data.
  // templateReports.reporterUserId is onDelete: "set null", so reports the
  // user filed stay in the moderation queue, anonymized.
  // Note: getCurrentUser() looks the user up in the database, so once the
  // row is gone the session is dead even before the client signs out.
  await db.delete(users).where(eq(users.id, user.id));

  revalidatePath("/");
  return { success: true };
}
