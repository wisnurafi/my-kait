"use client";

/**
 * Admin login form. Submits via adminLoginAction; on success navigates
 * to the dashboard (the session cookie is set by the action).
 */

import { useActionState, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HookLogo } from "@/components/hook-logo";
import { Eye, EyeOff } from "lucide-react";
import {
  adminLoginAction,
  type AdminLoginState,
} from "@/server/actions/admin-auth";

export function AdminLoginForm() {
  const t = useTranslations("admin");
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, pending] = useActionState<AdminLoginState, FormData>(
    adminLoginAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      router.push("/admin");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className="panel p-8 w-full max-w-sm animate-fade-in">
      <div className="flex items-center gap-2.5 mb-6">
        <HookLogo size={36} />
        <div>
          <p className="font-display font-bold text-lg leading-none">my-kait</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-error mt-1">
            {t("title")}
          </p>
        </div>
      </div>

      <h1 className="text-xl mb-1">{t("loginTitle")}</h1>
      <p className="text-sm text-fg-secondary mb-6">{t("loginSubtitle")}</p>

      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="admin-email">{t("email")}</Label>
          <Input
            id="admin-email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            required
            className="mt-1"
            disabled={pending}
          />
        </div>
        <div>
          <Label htmlFor="admin-password">{t("password")}</Label>
          <div className="relative mt-1">
            <Input
              id="admin-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-10"
              disabled={pending}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
              disabled={pending}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {state.error && (
          <p className="text-xs text-error" role="alert">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t("loggingIn") : t("login")}
        </Button>
      </form>
    </div>
  );
}
