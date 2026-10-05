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
import { sendRequestSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/ratelimit";
import { getActionT } from "@/server/i18n";
import { substitutePayloadVariables } from "@/lib/template-vars";
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
  // in the send form. Validated strictly; malformed input is ignored.
  let customVars: Record<string, string> | undefined;
  const customVarsRaw = String(formData.get("customVars") ?? "");
  if (customVarsRaw) {
    try {
      const parsed: unknown = JSON.parse(customVarsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const entries = Object.entries(parsed as Record<string, unknown>);
        const valid =
          entries.length > 0 &&
          entries.length <= 20 &&
          entries.every(
            ([k, v]) =>
              typeof v === "string" &&
              v.length <= 500 &&
              /^\{[^{}]+\}$/.test(k) &&
              k.length <= 60,
          );
        if (valid) {
          customVars = Object.fromEntries(
            entries.map(([k, v]) => [k, v as string]),
          );
        }
      }
    } catch {
      // ignore malformed customVars
    }
  }

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
      
      const targetUrl = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
      const processedPayload = substitutePayloadVariables(payload, customVars);
      const start = Date.now();
      const result = await sendWebhookMessage(targetUrl, processedPayload);
      const latencyMs = Date.now() - start;

      let status: MessageStatus;
      if (result.success) status = "sent";
      else if (result.rateLimited) status = "rate_limited";
      else status = "failed";

      await db.insert(messageLogs).values({
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
      });

      // Update webhook
      await db.update(webhooks).set({ lastUsedAt: new Date() }).where(eq(webhooks.id, wh[0].id));
      if (result.httpStatus === 404 || result.httpStatus === 401) {
        await db.update(webhooks).set({ lastStatus: "invalid" }).where(eq(webhooks.id, wh[0].id));
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

  await db.insert(messageLogs).values({
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
  });

  // Update webhook lastUsedAt
  if (webhookRecord) {
    await db
      .update(webhooks)
      .set({ lastUsedAt: new Date() })
      .where(eq(webhooks.id, webhookRecord.id));

    // Mark webhook invalid if 404/401
    if (result.httpStatus === 404 || result.httpStatus === 401) {
      await db
        .update(webhooks)
        .set({ lastStatus: "invalid" })
        .where(eq(webhooks.id, webhookRecord.id));
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

  if (webhookRecord) {
    await db
      .update(webhooks)
      .set({ lastUsedAt: new Date() })
      .where(eq(webhooks.id, webhookRecord.id));
    if (result.httpStatus === 404 || result.httpStatus === 401) {
      await db
        .update(webhooks)
        .set({ lastStatus: "invalid" })
        .where(eq(webhooks.id, webhookRecord.id));
    }
  }

  revalidatePath("/logs");
  if (!result.success) {
    return { error: result.error ?? t("generic") };
  }
  return { success: true, messageId: result.messageId, message: t("messageResent") };
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

  const conditions = [eq(messageLogs.userId, user.id)];

  if (filters.status) {
    conditions.push(eq(messageLogs.status, filters.status as MessageStatus));
  }
  if (filters.webhookId) {
    conditions.push(eq(messageLogs.webhookId, filters.webhookId));
  }
  if (filters.mode) {
    conditions.push(eq(messageLogs.mode, filters.mode as MessageMode));
  }
  if (filters.source) {
    conditions.push(eq(messageLogs.source, filters.source));
  }

  // Date filtering
  const now = new Date();
  if (filters.datePreset === "today") {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    conditions.push(gte(messageLogs.createdAt, startOfDay));
  } else if (filters.datePreset === "7d") {
    conditions.push(gte(messageLogs.createdAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)));
  } else if (filters.datePreset === "30d") {
    conditions.push(gte(messageLogs.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)));
  } else if (filters.datePreset === "custom") {
    if (filters.dateFrom) {
      conditions.push(gte(messageLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(messageLogs.createdAt, new Date(filters.dateTo)));
    }
  }

  // Search
  if (filters.search) {
    conditions.push(
      sql`(${messageLogs.webhookNameSnapshot} ILIKE ${`%${filters.search}%`} OR CAST(${messageLogs.payload} AS TEXT) ILIKE ${`%${filters.search}%`} OR ${messageLogs.discordMessageId} ILIKE ${`%${filters.search}%`})`,
    );
  }

  const sort = filters.sort ?? "newest";
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 12;

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
