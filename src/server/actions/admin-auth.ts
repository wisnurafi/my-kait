"use server";

/**
 * Admin login/logout — email + password, single account from env.
 * Completely separate from the Discord OAuth (Auth.js) session.
 * Login attempts are rate-limited per IP.
 */

import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
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

  const emailOk = safeEqual(parsed.data.email, env.ADMIN_EMAIL.toLowerCase());
  const passwordOk =
    emailOk &&
    (await verifyAdminPassword(
      parsed.data.password,
      env.ADMIN_PASSWORD_HASH,
    ));
  if (!emailOk || !passwordOk) {
    return { error: t("invalidCredentials") };
  }

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
