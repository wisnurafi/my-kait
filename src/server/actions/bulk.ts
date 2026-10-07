"use server";

/**
 * Bulk operations for templates and webhooks.
 * Every action verifies ownership per id — only rows owned by the
 * caller are affected, silently ignoring foreign ids.
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { templates, webhooks, templateFolders } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getActionT } from "@/server/i18n";

const MAX_BULK_IDS = 100;

type BulkResult = Promise<{ error: string } | { success: true; count: number }>;

function cleanIds(ids: string[]): string[] {
  return [
    ...new Set(ids.filter((id) => typeof id === "string" && id.length > 0)),
  ].slice(0, MAX_BULK_IDS);
}

async function ownedIds(
  kind: "template" | "webhook",
  userId: string,
  ids: string[],
): Promise<string[]> {
  if (kind === "template") {
    const rows = await db
      .select({ id: templates.id })
      .from(templates)
      .where(and(eq(templates.userId, userId), inArray(templates.id, ids)));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: webhooks.id })
    .from(webhooks)
    .where(and(eq(webhooks.userId, userId), inArray(webhooks.id, ids)));
  return rows.map((r) => r.id);
}

async function verifyFolder(
  userId: string,
  folderId: string | null,
): Promise<boolean> {
  if (!folderId) return true;
  const rows = await db
    .select({ id: templateFolders.id })
    .from(templateFolders)
    .where(
      and(
        eq(templateFolders.id, folderId),
        eq(templateFolders.userId, userId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/* --- Bulk delete templates --- */

export async function bulkDeleteTemplatesAction(ids: string[]): BulkResult {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const clean = cleanIds(ids);
  if (clean.length === 0) return { error: t("templateNotFound") };

  const owned = await ownedIds("template", user.id, clean);
  if (owned.length === 0) return { error: t("templateNotFound") };

  await db.delete(templates).where(inArray(templates.id, owned));
  revalidatePath("/templates");
  return { success: true, count: owned.length };
}

/* --- Bulk move templates to folder (null = unfiled) --- */

export async function bulkMoveTemplatesAction(
  ids: string[],
  folderId: string | null,
): BulkResult {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const clean = cleanIds(ids);
  if (clean.length === 0) return { error: t("templateNotFound") };
  if (!(await verifyFolder(user.id, folderId)))
    return { error: t("folderNotFound") };

  const owned = await ownedIds("template", user.id, clean);
  if (owned.length === 0) return { error: t("templateNotFound") };

  await db
    .update(templates)
    .set({ folderId, updatedAt: new Date() })
    .where(inArray(templates.id, owned));
  revalidatePath("/templates");
  return { success: true, count: owned.length };
}

/* --- Bulk delete webhooks --- */

export async function bulkDeleteWebhooksAction(ids: string[]): BulkResult {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const clean = cleanIds(ids);
  if (clean.length === 0) return { error: t("webhookNotFound") };

  const owned = await ownedIds("webhook", user.id, clean);
  if (owned.length === 0) return { error: t("webhookNotFound") };

  await db.delete(webhooks).where(inArray(webhooks.id, owned));
  revalidatePath("/webhooks");
  return { success: true, count: owned.length };
}

/* --- Bulk move webhooks to folder (null = unfiled) --- */

export async function bulkMoveWebhooksAction(
  ids: string[],
  folderId: string | null,
): BulkResult {
  const user = await requireAuth();
  const t = await getActionT("errors");
  const clean = cleanIds(ids);
  if (clean.length === 0) return { error: t("webhookNotFound") };
  if (!(await verifyFolder(user.id, folderId)))
    return { error: t("folderNotFound") };

  const owned = await ownedIds("webhook", user.id, clean);
  if (owned.length === 0) return { error: t("webhookNotFound") };

  await db
    .update(webhooks)
    .set({ folderId })
    .where(inArray(webhooks.id, owned));
  revalidatePath("/webhooks");
  return { success: true, count: owned.length };
}
