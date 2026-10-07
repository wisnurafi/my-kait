"use server";

/**
 * Admin login/logout — email + password, single account from env.
 * Completely separate from the Discord OAuth (Auth.js) session.
 * Login attempts are rate-limited per IP.
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { Redis } from "@upstash/redis";
import { env, isRateLimitEnabled } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/ratelimit";
import { getActionT } from "@/server/i18n";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
} from "@/lib/admin-session";
import {
  verifyAdminPassword,
  safeEqual,
} from "@/server/admin-password";
import { logAdminAction } from "@/server/actions/admin";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export type AdminLoginState = { error?: string; success?: boolean };

/**
 * Well-formed but never-matching scrypt hash. Used so a wrong-email login
 * attempt still pays the full scrypt cost — otherwise the response-time
 * difference would reveal whether ADMIN_EMAIL was guessed correctly.
 * The format MUST match hashAdminPassword's output (`scrypt$<32 hex>$<128 hex>`);
 * a malformed value would make verifyAdminPassword return false WITHOUT
 * doing the scrypt work, defeating the purpose.
 */
const DUMMY_ADMIN_HASH = `scrypt$${"0".repeat(32)}$${"0".repeat(128)}`;

/** Upstash client for login lockout bookkeeping (null when not configured). */
const lockoutRedis: Redis | null = isRateLimitEnabled()
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Progressive lockout: 10 failed attempts within 15 minutes -> locked out
// for 30 minutes. Keyed by (lowercased) email so attackers can't evade by
// rotating IPs, and one targeted email doesn't lock out others.
const LOGIN_FAIL_KEY = (email: string) => `mykait:admin:login:fail:${email}`;
const LOGIN_LOCK_KEY = (email: string) => `mykait:admin:login:locked:${email}`;
const MAX_LOGIN_FAILS = 10;
const FAIL_WINDOW_SECONDS = 900;
const LOCK_SECONDS = 1800;

async function isAccountLocked(email: string): Promise<boolean> {
  if (!lockoutRedis) return false;
  try {
    return (await lockoutRedis.get(LOGIN_LOCK_KEY(email))) !== null;
  } catch (e) {
    logger.warn(
      "admin-auth",
      "lockout check failed, failing open",
      e instanceof Error ? e.message : e,
    );
    return false;
  }
}

async function recordFailedLogin(email: string): Promise<void> {
  if (!lockoutRedis) return;
  try {
    const fails = await lockoutRedis.incr(LOGIN_FAIL_KEY(email));
    if (fails === 1) {
      await lockoutRedis.expire(LOGIN_FAIL_KEY(email), FAIL_WINDOW_SECONDS);
    }
    if (fails >= MAX_LOGIN_FAILS) {
      await lockoutRedis.set(LOGIN_LOCK_KEY(email), "1", { ex: LOCK_SECONDS });
      // Loud server-side signal — the client only ever sees invalidCredentials.
      logger.warn("admin-auth", `admin login locked for ${email} (${LOCK_SECONDS}s)`);
    }
  } catch (e) {
    logger.warn(
      "admin-auth",
      "lockout bookkeeping failed, failing open",
      e instanceof Error ? e.message : e,
    );
  }
}

async function clearLoginLockout(email: string): Promise<void> {
  if (!lockoutRedis) return;
  try {
    await lockoutRedis.del(LOGIN_FAIL_KEY(email), LOGIN_LOCK_KEY(email));
  } catch (e) {
    logger.warn(
      "admin-auth",
      "lockout clear failed",
      e instanceof Error ? e.message : e,
    );
  }
}

export async function adminLoginAction(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const t = await getActionT("admin");

  // Rate limit by IP (Upstash; skipped when not configured)
  const ip = await getClientIp();
  const rl = await checkRateLimit("login", `admin:${ip}`);
  if (!rl.success) return { error: t("rateLimited") };

  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: t("invalidCredentials") };

  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD_HASH) {
    // Admin not configured — never reveal which part is missing
    return { error: t("invalidCredentials") };
  }

  const email = parsed.data.email;

  // Locked accounts are rejected with the GENERIC error (never "account is
  // locked"): a distinct message would confirm the email belongs to the admin
  // and let an attacker verify a deliberate lockout (DoS). The dummy scrypt
  // keeps response timing uniform with a normal failed attempt.
  if (await isAccountLocked(email)) {
    await verifyAdminPassword(parsed.data.password, DUMMY_ADMIN_HASH);
    return { error: t("invalidCredentials") };
  }

  const emailOk = safeEqual(email, env.ADMIN_EMAIL.toLowerCase());
  // Always run the scrypt verification, even for a wrong email, so the
  // response time doesn't reveal whether the email was correct.
  const passwordOk = await verifyAdminPassword(
    parsed.data.password,
    emailOk ? env.ADMIN_PASSWORD_HASH : DUMMY_ADMIN_HASH,
  );
  if (!emailOk || !passwordOk) {
    await recordFailedLogin(email);
    return { error: t("invalidCredentials") };
  }
  await clearLoginLockout(email);

  const token = await createAdminSession(env.ADMIN_EMAIL);
  (await cookies()).set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  await logAdminAction("admin.login");
  return { success: true };
}

export async function adminLogoutAction(): Promise<void> {
  try {
    await logAdminAction("admin.logout");
  } catch {
    // already logged out — nothing to record
  }
  (await cookies()).delete(ADMIN_COOKIE_NAME);
}
