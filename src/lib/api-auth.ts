/**
 * Public REST API key authentication.
 *
 * Key format: mk_live_<base64url random>. Only the SHA-256 hash is stored
 * in the database — the raw key is shown to the user ONCE at creation and
 * is never persisted or logged anywhere (logs carry only the key id/prefix).
 */

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { apiKeys, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { checkRateLimit } from "@/lib/ratelimit";

export const API_KEY_PREFIX = "mk_live_";

export interface ApiKeyAuth {
  userId: string;
  keyId: string;
  keyPrefix: string;
  scopes: string[];
}

export class ApiAuthError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.code = code;
  }
}

/** SHA-256 hex of the raw key — this is what gets stored and looked up. */
export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Generate a new raw API key. The caller must display `raw` to the user
 * exactly once and store only `hash`.
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = API_KEY_PREFIX + randomBytes(24).toString("base64url");
  return { raw, hash: hashApiKey(raw), prefix: raw.slice(0, 12) };
}

/**
 * Authenticate a request via `Authorization: Bearer mk_live_...`.
 * Verifies hash, revocation, expiry, scope, and the per-key rate limit
 * (5 sends/minute — stricter than the dashboard limit).
 * Updates the key's last_used_at on success.
 *
 * @throws ApiAuthError with an HTTP status and machine-readable code.
 */
export async function requireApiKey(requiredScope = "send"): Promise<ApiKeyAuth> {
  const authHeader = (await headers()).get("authorization");
  const raw =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!raw) {
    throw new ApiAuthError(401, "missing_api_key", "Missing Authorization header. Use: Bearer mk_live_...");
  }
  if (!raw.startsWith(API_KEY_PREFIX)) {
    throw new ApiAuthError(401, "invalid_api_key", "Invalid API key.");
  }

  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(raw)))
    .limit(1);
  const key = rows[0];

  if (!key) {
    throw new ApiAuthError(401, "invalid_api_key", "Invalid API key.");
  }
  if (key.revokedAt) {
    throw new ApiAuthError(401, "api_key_revoked", "This API key has been revoked.");
  }
  if (key.expiresAt && key.expiresAt < new Date()) {
    throw new ApiAuthError(401, "api_key_expired", "This API key has expired.");
  }
  if (!key.scopes.includes(requiredScope)) {
    throw new ApiAuthError(
      403,
      "insufficient_scope",
      `This API key does not have the '${requiredScope}' scope.`,
    );
  }

  // Suspended users lose API access too — otherwise suspend is cosmetic for
  // anyone holding a key (the dashboard is blocked via session callbacks,
  // but /api/v1/send would keep working forever).
  const [owner] = await db
    .select({ isSuspended: users.isSuspended })
    .from(users)
    .where(eq(users.id, key.userId))
    .limit(1);
  if (!owner || owner.isSuspended) {
    throw new ApiAuthError(
      403,
      "account_suspended",
      "This account has been suspended.",
    );
  }

  const rl = await checkRateLimit("apiSend", key.id);
  if (!rl.success) {
    throw new ApiAuthError(429, "rate_limited", "API rate limit exceeded (5 requests/minute per key).");
  }

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id));

  return {
    userId: key.userId,
    keyId: key.id,
    keyPrefix: key.keyPrefix,
    scopes: key.scopes,
  };
}
