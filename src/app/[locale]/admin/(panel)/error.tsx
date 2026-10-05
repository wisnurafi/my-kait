"use client";

/**
 * Admin panel error boundary — shows a retryable error card instead of
 * falling through to the generic root boundary.
 */

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

export default function AdminPanelError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("admin");

  return (
    <div className="panel p-8 max-w-md mx-auto mt-12 text-center">
      <TriangleAlert size={28} className="mx-auto text-warning mb-4" />
      <p className="font-display font-bold text-xl mb-2">{t("errorTitle")}</p>
      <p className="text-sm text-fg-secondary mb-6">{t("errorBody")}</p>
      <Button onClick={() => reset()}>{t("retry")}</Button>
    </div>
  );
}
