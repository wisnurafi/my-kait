/**
 * Public REST API v1 — send a message.
 *
 * POST /api/v1/send
 * Authorization: Bearer mk_live_...
 *
 * Body (JSON):
 *   { "webhookId": "<saved webhook id>", "payload": {...}, "mode": "normal",
 *     "savePayload": true, "idempotencyKey": "optional" }
 *   — or "manualUrl" instead of "webhookId" (one of them is required).
 *
 * The key may only do what its owner can do: the webhook must belong to
 * the key owner. Payload validation uses the same zod schema as the
 * dashboard — no shortcuts.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhooks, messageLogs } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { requireApiKey, ApiAuthError } from "@/lib/api-auth";
import { sendRequestSchema } from "@/lib/validations";
import {
  sendWebhookMessage,
  validateWebhookUrl,
} from "@/lib/discord";
import { decryptWebhookUrl, encryptWebhookUrl } from "@/lib/crypto";
import { markWebhookInvalid } from "@/lib/webhook-health";
import { logger } from "@/lib/logger";
import enMessages from "@/messages/en.json";

/* Route handlers have no request locale — API errors are always English. */
const t = (key: string): string =>
  (enMessages.errors as Record<string, string>)[key] ?? key;

function err(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function POST(req: Request) {
  let auth;
  try {
    auth = await requireApiKey("send");
  } catch (e) {
    if (e instanceof ApiAuthError) return err(e.code, e.message, e.status);
    throw e;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return err("invalid_json", t("payloadInvalid"), 400);
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const parsed = sendRequestSchema(t).safeParse({
    webhookId: typeof b.webhookId === "string" ? b.webhookId : undefined,
    manualUrl: typeof b.manualUrl === "string" ? b.manualUrl : undefined,
    payload: b.payload,
    mode: typeof b.mode === "string" ? b.mode : "normal",
    savePayload: typeof b.savePayload === "boolean" ? b.savePayload : true,
  });
  if (!parsed.success) {
    return err(
      "validation_failed",
      parsed.error.issues[0]?.message ?? t("payloadInvalid"),
      400,
    );
  }

  const idempotencyKey =
    typeof b.idempotencyKey === "string" && b.idempotencyKey
      ? b.idempotencyKey.slice(0, 100)
      : undefined;

  // Idempotency: a retried request with the same key returns the original
  // outcome instead of sending a duplicate message.
  if (idempotencyKey) {
    const prev = await db
      .select({
        id: messageLogs.id,
        status: messageLogs.status,
        discordMessageId: messageLogs.discordMessageId,
        error: messageLogs.error,
      })
      .from(messageLogs)
      .where(
        and(
          eq(messageLogs.userId, auth.userId),
          eq(messageLogs.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (prev.length > 0) {
      if (prev[0].status === "sent") {
        return NextResponse.json({
          ok: true,
          data: {
            logId: prev[0].id,
            messageId: prev[0].discordMessageId ?? undefined,
            status: "sent",
            deduplicated: true,
          },
        });
      }
      return err("duplicate_failed", prev[0].error ?? t("generic"), 409);
    }
  }

  // Resolve target — a key can only send via its owner's webhooks.
  let url: string;
  let webhookRecord: { id: string; name: string } | null = null;
  if (parsed.data.webhookId) {
    const wh = await db
      .select()
      .from(webhooks)
      .where(
        and(
          eq(webhooks.id, parsed.data.webhookId),
          eq(webhooks.userId, auth.userId),
        ),
      )
      .limit(1);
    if (wh.length === 0) {
      return err("webhook_not_found", t("webhookNotFound"), 404);
    }
    if (wh[0].lastStatus === "invalid") {
      return err("webhook_invalid", t("webhookMarkedInvalid"), 422);
    }
    url = decryptWebhookUrl(wh[0].urlEncrypted, wh[0].keyVersion);
    webhookRecord = { id: wh[0].id, name: wh[0].name };
  } else if (parsed.data.manualUrl) {
    const validation = validateWebhookUrl(parsed.data.manualUrl);
    if (!validation.valid) {
      return err("invalid_webhook_url", t("webhookInvalid"), 400);
    }
    url = parsed.data.manualUrl;
  } else {
    return err("missing_target", t("selectWebhookOrUrl"), 400);
  }

  const start = Date.now();
  const result = await sendWebhookMessage(
    url,
    parsed.data.payload as Record<string, unknown>,
  );
  const latencyMs = Date.now() - start;

  const status = result.success
    ? "sent"
    : result.rateLimited
      ? "rate_limited"
      : "failed";

  // Log the attempt (manual URLs stored encrypted, like the dashboard)
  let manualUrlEncrypted: string | null = null;
  let manualUrlKeyVersion: string | null = null;
  if (!webhookRecord) {
    const enc = encryptWebhookUrl(url);
    manualUrlEncrypted = enc.encrypted;
    manualUrlKeyVersion = enc.keyVersion;
  }

  // Best-effort log: the message was already sent — a failed insert must
  // not fail the request (the 2026-10-02 incident class). The caller is
  // told via logPersisted so it isn't misled.
  let logPersisted = true;
  let inserted: Array<{ id: string }> = [];
  try {
    inserted = await db
      .insert(messageLogs)
      .values({
        userId: auth.userId,
        webhookId: webhookRecord?.id ?? null,
        webhookNameSnapshot: webhookRecord?.name ?? "Manual URL",
        manualUrlEncrypted,
        manualUrlKeyVersion,
        mode: parsed.data.mode,
        payload: parsed.data.savePayload ? (parsed.data.payload as Record<string, unknown>) : null,
        status,
        httpStatus: result.httpStatus,
        latencyMs,
        discordMessageId: result.messageId,
        error: result.error,
        source: "api",
        idempotencyKey: idempotencyKey ?? null,
      })
      .onConflictDoNothing({
        target: [messageLogs.userId, messageLogs.idempotencyKey],
      })
      .returning({ id: messageLogs.id });
  } catch (e) {
    logger.error("api", "v1/send: message log insert failed", e instanceof Error ? e.message : e);
    logPersisted = false;
  }

  let logId = inserted[0]?.id as string | undefined;
  let deduplicated = false;
  // Only consult the race-recovery path when the insert actually ran: a
  // thrown insert means "unknown", not "lost a race".
  if (logPersisted && idempotencyKey && !logId) {
    // Lost a concurrent race — return the winner's outcome.
    const prev = await db
      .select({
        id: messageLogs.id,
        status: messageLogs.status,
        discordMessageId: messageLogs.discordMessageId,
      })
      .from(messageLogs)
      .where(
        and(
          eq(messageLogs.userId, auth.userId),
          eq(messageLogs.idempotencyKey, idempotencyKey),
        ),
      )
      .limit(1);
    if (prev.length > 0 && prev[0].status === "sent") {
      logId = prev[0].id;
      deduplicated = true;
      return NextResponse.json({
        ok: true,
        data: {
          logId,
          messageId: prev[0].discordMessageId ?? undefined,
          status: "sent",
          deduplicated,
          logPersisted,
        },
      });
    }
  }

  // Best-effort webhook bookkeeping — must not fail the request.
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
      logger.error("api", "v1/send: webhook bookkeeping failed", e instanceof Error ? e.message : e);
    }
  }

  if (!result.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: result.rateLimited ? "discord_rate_limited" : "discord_error",
          message: result.error ?? t("discordError"),
          logId,
          logPersisted,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: {
      logId,
      messageId: result.messageId,
      status,
      deduplicated,
      logPersisted,
    },
  });
}
