"use server";

/**
 * Public REST API key management server actions.
 * Only the SHA-256 hash is stored — the raw key is returned to the caller
 * exactly once at creation and never persisted.
 */

import { db } from "@/lib/db";
import { apiKeys } from "@/lib/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { getActionT } from "@/server/i18n";
import { generateApiKey } from "@/lib/api-auth";

const MAX_ACTIVE_KEYS = 10;

function toPublicKey(k: typeof apiKeys.$inferSelect) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

export type ApiKeyPublic = ReturnType<typeof toPublicKey>;
export type NewApiKey = ApiKeyPublic & { raw: string };

/* --- List keys (never exposes the hash or raw key) --- */
export async function listApiKeysAction(): Promise<ApiKeyPublic[]> {
  const user = await requireAuth();
  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, user.id))
    .orderBy(desc(apiKeys.createdAt));
  return keys.map(toPublicKey);
}

/* --- Create key — returns the raw key ONCE --- */
export async function createApiKeyAction(input: {
  name: string;
  expiresInDays: number | null;
}): Promise<{ error: string } | { key: NewApiKey }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const name = input.name.trim();
  if (!name) return { error: t("apiKeyNameRequired") };
  if (name.length > 50) return { error: t("apiKeyNameTooLong") };

  const active = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, user.id), isNull(apiKeys.revokedAt)));
  if (active.length >= MAX_ACTIVE_KEYS) {
    return { error: t("apiKeyLimitReached") };
  }

  const expiresInDays =
    input.expiresInDays === 30 || input.expiresInDays === 90 || input.expiresInDays === 365
      ? input.expiresInDays
      : null;

  const { raw, hash, prefix } = generateApiKey();
  const [created] = await db
    .insert(apiKeys)
    .values({
      userId: user.id,
      keyHash: hash,
      keyPrefix: prefix,
      name,
      scopes: ["send"],
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 86_400_000)
        : null,
    })
    .returning();

  return {
    key: { ...toPublicKey(created), raw },
  };
}

/* --- Revoke key (ownership enforced; revoked keys stay for audit) --- */
export async function revokeApiKeyAction(
  id: string,
): Promise<{ error: string } | { revoked: true }> {
  const user = await requireAuth();
  const t = await getActionT("errors");

  const rows = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, user.id),
        isNull(apiKeys.revokedAt),
      ),
    )
    .returning({ id: apiKeys.id });

  if (rows.length === 0) return { error: t("apiKeyNotFound") };
  return { revoked: true as const };
}
