"use server";

/**
 * Scheduled message management server actions.
 * One-shot schedules; a per-minute cron dispatches due rows.
 */

import { db } from "@/lib/db";
import { scheduledMessages, webhooks } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getActionT } from "@/server/i18n";
import { sendRequestSchema } from "@/lib/validations";
import { encryptWebhookUrl } from "@/lib/crypto";
import { validateWebhookUrl } from "@/lib/discord";
import { substitutePayloadVariables } from "@/lib/template-vars";

const MIN_LEAD_MS = 60_000; // must be at least 1 minute in the future
const MAX_LEAD_MS = 365 * 24 * 60 * 60_000; // at most 1 year out

function toPublic(s: typeof scheduledMessages.$inferSelect) {
  return {
    id: s.id,
    webhookId: s.webhookId,
    webhookNameSnapshot: s.webhookNameSnapshot,
    isManualUrl: !s.webhookId,
    mode: s.mode,
    preview: payloadPreview(s.payload),
    scheduledAt: s.scheduledAt.toISOString(),
    status: s.status,
    attempts: s.attempts,
    lastError: s.lastError,
    createdAt: s.createdAt.toISOString(),
  };
}

/** Short human-readable excerpt of the payload for list rows. */
function payloadPreview(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const content = typeof p.content === "string" ? p.content.trim() : "";
  if (content) return content.slice(0, 90);
  const embeds = Array.isArray(p.embeds)
    ? (p.embeds as Array<Record<string, unknown>>)
    : [];
  const e0 = embeds[0];
  if (e0 && typeof e0 === "object") {
    const title = typeof e0.title === "string" ? e0.title.trim() : "";
    const desc = typeof e0.description === "string" ? e0.description.trim() : "";
    const joined = (title + (title && desc ? " — " : "") + desc).trim();
    if (joined) return joined.slice(0, 90);
  }
  return "";
}

export type ScheduledPublic = ReturnType<typeof toPublic>;

/* --- Schedule a message --- */
export async function scheduleMessageAction(input: {
  webhookId?: string;
  manualUrl?: string;
  payload: unknown;
  mode: "normal" | "embed" | "both";
  customVars?: Record<string, string>;
  scheduledAt: string; // ISO 8601
}): Promise<{ error: string } | { scheduled: ScheduledPublic }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const at = new Date(input.scheduledAt);
  if (Number.isNaN(at.getTime())) {
    return { error: t("scheduledInvalidDate") };
  }
  const now = Date.now();
  if (at.getTime() < now + MIN_LEAD_MS) {
    return { error: t("scheduledTooSoon") };
  }
  if (at.getTime() > now + MAX_LEAD_MS) {
    return { error: t("scheduledTooFar") };
  }

  // Same payload validation as an immediate send — no shortcuts.
  const parsed = sendRequestSchema(t).safeParse({
    webhookId: input.webhookId || undefined,
    manualUrl: input.manualUrl || undefined,
    payload: input.payload,
    mode: input.mode,
    savePayload: true,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t("payloadInvalid") };
  }

  // Resolve + verify the target now, so a typo fails fast instead of at 3am.
  let webhookId: string | null = null;
  let webhookName = "Manual URL";
  let manualUrlEncrypted: string | null = null;
  let manualUrlKeyVersion: string | null = null;

  if (parsed.data.webhookId) {
    const wh = await db
      .select()
      .from(webhooks)
      .where(
        and(eq(webhooks.id, parsed.data.webhookId), eq(webhooks.userId, user.id)),
      )
      .limit(1);
    if (wh.length === 0) return { error: t("webhookNotFound") };
    if (wh[0].lastStatus === "invalid") return { error: t("webhookMarkedInvalid") };
    webhookId = wh[0].id;
    webhookName = wh[0].name;
  } else if (parsed.data.manualUrl) {
    const v = validateWebhookUrl(parsed.data.manualUrl);
    if (!v.valid) return { error: t("webhookInvalid") };
    const enc = encryptWebhookUrl(parsed.data.manualUrl);
    manualUrlEncrypted = enc.encrypted;
    manualUrlKeyVersion = enc.keyVersion;
  } else {
    return { error: t("selectWebhookOrUrl") };
  }

  // Substitute custom variables now — what you see is what gets sent.
  const processedPayload = substitutePayloadVariables(
    parsed.data.payload as Record<string, unknown>,
    input.customVars,
  );

  const [created] = await db
    .insert(scheduledMessages)
    .values({
      userId: user.id,
      webhookId,
      manualUrlEncrypted,
      manualUrlKeyVersion,
      webhookNameSnapshot: webhookName,
      payload: processedPayload,
      mode: parsed.data.mode,
      scheduledAt: at,
    })
    .returning();

  return { scheduled: toPublic(created) };
}

/* --- List my scheduled messages --- */
export async function listScheduledAction(): Promise<ScheduledPublic[]> {
  const user = await requireAuth();
  const rows = await db
    .select()
    .from(scheduledMessages)
    .where(eq(scheduledMessages.userId, user.id))
    .orderBy(desc(scheduledMessages.scheduledAt));
  return rows.map(toPublic);
}

/* --- Cancel a pending schedule --- */
export async function cancelScheduledAction(
  id: string,
): Promise<{ error: string } | { cancelled: true }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const rows = await db
    .update(scheduledMessages)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(scheduledMessages.id, id),
        eq(scheduledMessages.userId, user.id),
        eq(scheduledMessages.status, "pending"),
      ),
    )
    .returning({ id: scheduledMessages.id });

  if (rows.length === 0) return { error: t("scheduledNotFound") };
  return { cancelled: true as const };
}
