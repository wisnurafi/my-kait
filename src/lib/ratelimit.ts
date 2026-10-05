/**
 * Rate limiting utilities — Upstash Ratelimit.
 * See PRD section 5.4.
 * If Upstash is not configured, rate limiting is skipped (dev mode).
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { env, isRateLimitEnabled } from "./env";

/**
 * Create a rate limiter with fixed window.
 * Returns null if Upstash is not configured.
 */
function createLimiter(
  limit: number,
  window: string,
): Ratelimit | null {
  if (!isRateLimitEnabled()) return null;

  return new Ratelimit({
    redis: new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.fixedWindow(limit, window as any),
    prefix: "mykait",
    analytics: true,
  });
}

// Per-user limiters
const sendLimiter = createLimiter(10, "60 s");      // 10 sends per minute
const pingLimiter = createLimiter(20, "60 s");       // 20 pings per minute
const addWebhookLimiter = createLimiter(10, "60 s"); // 10 webhook additions per minute
const loginLimiter = createLimiter(5, "60 s");       // 5 login attempts per minute
const publicTemplateLimiter = createLimiter(30, "60 s"); // 30 views per minute
const reportLimiter = createLimiter(5, "1 h"); // 5 reports per hour per IP

/**
 * Check rate limit. Returns { success, remaining, reset }.
 * If rate limiting is disabled, always returns success.
 */
export async function checkRateLimit(
  type: "send" | "ping" | "addWebhook" | "login" | "publicTemplate" | "report",
  identifier: string,
): Promise<{ success: boolean; remaining: number; reset: number }> {
  const limiter = {
    send: sendLimiter,
    ping: pingLimiter,
    addWebhook: addWebhookLimiter,
    login: loginLimiter,
    publicTemplate: publicTemplateLimiter,
    report: reportLimiter,
  }[type];

  if (!limiter) {
    // Rate limiting disabled — allow
    return { success: true, remaining: 999, reset: 0 };
  }

  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Resolve the client IP for rate limiting.
 * Takes the LAST non-empty entry of X-Forwarded-For: entries appended by
 * trusted edges (e.g. Vercel) sit at the end, while the leftmost entry is
 * attacker-controlled and must not be trusted.
 */
export async function getClientIp(): Promise<string> {
  const xff = (await headers()).get("x-forwarded-for");
  const entries = (xff ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return entries.length > 0 ? entries[entries.length - 1] : "unknown";
}
