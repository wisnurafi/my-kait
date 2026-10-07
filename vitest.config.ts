import { defineConfig } from "vitest/config";

/**
 * Unit tests for pure lib functions — no DB, no browser.
 * Dummy env vars are injected so modules importing @/lib/env
 * (e.g. crypto) don't throw at import time.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      WEBHOOK_ENCRYPTION_KEY: "0123456789abcdef".repeat(4),
      WEBHOOK_ENCRYPTION_KEY_VERSION: "1",
      DISCORD_CLIENT_ID: "test-client-id",
      DISCORD_CLIENT_SECRET: "test-client-secret",
      AUTH_SECRET: "test-auth-secret",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      CRON_SECRET: "test-cron-secret",
    },
  },
});
