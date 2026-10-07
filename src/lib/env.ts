/**
 * Environment variable validation.
 * All secrets live here — never in the repo.
 * See .env.example for how to obtain each value.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}. See .env.example for instructions.`);
  }
  return value;
}

function optional(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

export const env = {
  // Discord OAuth — https://discord.com/developers/applications
  DISCORD_CLIENT_ID: required("DISCORD_CLIENT_ID", process.env.DISCORD_CLIENT_ID),
  DISCORD_CLIENT_SECRET: required("DISCORD_CLIENT_SECRET", process.env.DISCORD_CLIENT_SECRET),

  // Auth.js secret — generate with: openssl rand -base64 32
  AUTH_SECRET: required("AUTH_SECRET", process.env.AUTH_SECRET),

  // App URL
  AUTH_URL: optional(process.env.AUTH_URL, "http://localhost:3000"),

  // Neon Postgres — https://neon.tech
  DATABASE_URL: required("DATABASE_URL", process.env.DATABASE_URL),

  // Upstash Redis (rate limiting) — https://upstash.com
  UPSTASH_REDIS_REST_URL: optional(process.env.UPSTASH_REDIS_REST_URL, ""),
  UPSTASH_REDIS_REST_TOKEN: optional(process.env.UPSTASH_REDIS_REST_TOKEN, ""),

  // Webhook URL encryption key — generate with: openssl rand -hex 32
  WEBHOOK_ENCRYPTION_KEY: required("WEBHOOK_ENCRYPTION_KEY", process.env.WEBHOOK_ENCRYPTION_KEY),
  WEBHOOK_ENCRYPTION_KEY_VERSION: optional(process.env.WEBHOOK_ENCRYPTION_KEY_VERSION, "1"),

  // Vercel Cron secret — generate with: openssl rand -hex 16
  // SECURITY: fail-closed in production. A committed default would let anyone
  // trigger /api/cron/* with a publicly known value.
  CRON_SECRET: (() => {
    const v = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === "production" && (!v || v === "dev-cron-secret")) {
      throw new Error(
        "CRON_SECRET must be set to a strong random value in production. Generate with: openssl rand -hex 16",
      );
    }
    return v ?? "dev-cron-secret";
  })(),

  // Admin dashboard (single account, no signup).
  // Login is email + password via /<locale>/admin/login — separate from Discord OAuth.
  // Generate the hash with: node scripts/hash-admin-password.mjs
  // NEVER commit real values. Optional: when unset, admin login is disabled.
  ADMIN_EMAIL: optional(process.env.ADMIN_EMAIL, ""),
  ADMIN_PASSWORD_HASH: optional(process.env.ADMIN_PASSWORD_HASH, ""),

  // Discord webhook URL for admin notifications (e.g. new template reports).
  // Optional: when unset, no notifications are sent. Create a webhook in a
  // private channel/DM: Discord channel settings → Integrations → Webhooks.
  ADMIN_NOTIFY_WEBHOOK_URL: optional(process.env.ADMIN_NOTIFY_WEBHOOK_URL, ""),
};

/**
 * Check if rate limiting is available (Upstash configured).
 * If not configured, rate limiting is skipped (dev mode only).
 *
 * SECURITY: in production this must never be silently disabled — a missing
 * Upstash config would turn off ALL rate limits (login brute-force protection,
 * API key guessing limits, send limits) without anyone noticing.
 */
export const isRateLimitEnabled = (): boolean => {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
};

// Fail-closed: crash boot instead of running production with zero rate limiting.
if (
  process.env.NODE_ENV === "production" &&
  (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN)
) {
  throw new Error(
    "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production. " +
      "Rate limiting cannot be disabled in production.",
  );
}
