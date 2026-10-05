/**
 * Middleware: next-intl locale routing + Auth.js session.
 * Handles i18n locale prefixing and protects app routes.
 */

import createMiddleware from "next-intl/middleware";
import { auth } from "@/lib/auth";
import { routing } from "@/i18n/routing";
import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/admin-session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

// Public routes that don't require auth
const publicRoutes = [
  "/",
  "/t/[slug]",
  "/gallery",
  "/privacy",
  "/terms",
  "/docs",
  "/api/auth",
];

// Auth routes that should not be locale-prefixed
const authRoutes = ["/api/auth", "/api/cron"];

function isPublicRoute(pathname: string): boolean {
  // Check if it matches public patterns
  if (pathname === "/") return true;
  if (pathname.match(/^\/(id|en)\/?$/)) return true;
  if (pathname.match(/^\/(id|en)\/t\/[\w-]+\/?$/)) return true;
  if (pathname.match(/^\/(id|en)\/gallery\/?$/)) return true;
  if (pathname.match(/^\/(id|en)\/privacy\/?$/)) return true;
  if (pathname.match(/^\/(id|en)\/terms\/?$/)) return true;
  if (pathname.match(/^\/(id|en)\/docs\/?$/)) return true;
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/cron")) return true;
  return false;
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip auth/api routes from intl processing (except they still get handled)
  if (authRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Run next-intl middleware first (handles locale prefixing)
  const intlResponse = intlMiddleware(req);

  // Admin dashboard: separate email+password session (not Discord OAuth).
  // Guarded here AND inside every admin action/layout (defense in depth).
  const adminMatch = pathname.match(/^\/(id|en)\/admin(\/.*)?$/);
  if (adminMatch) {
    const locale = adminMatch[1];
    const rest = adminMatch[2] ?? "";
    const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const adminEmail = await verifyAdminSession(token);
    if (rest === "/login") {
      // Already logged in → bounce to dashboard
      if (adminEmail) {
        return NextResponse.redirect(new URL(`/${locale}/admin`, req.url));
      }
      return intlResponse;
    }
    if (!adminEmail) {
      return NextResponse.redirect(
        new URL(`/${locale}/admin/login`, req.url),
      );
    }
    return intlResponse;
  }

  // Check auth for protected routes
  // (session.user is stripped for suspended users — see auth.ts)
  if (!isPublicRoute(pathname)) {
    const session = await auth();
    if (!session?.user) {
      // Redirect to locale-prefixed home with login intent
      const locale = pathname.startsWith("/en") ? "en" : "id";
      const loginUrl = new URL(`/${locale}`, req.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // NOTE: logged-in users are intentionally allowed to visit the landing
  // page (previously this redirected to /dashboard, which made the landing
  // unreachable without logging out).

  return intlResponse;
}

export const config = {
  // Match all paths except static files and ALL api routes
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
