"use client";

/**
 * Toggle a share link active/inactive.
 */

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { setShareActive } from "@/server/actions/admin";

export function ShareToggle({
  shareId,
  isActive,
}: {
  shareId: string;
  isActive: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant={isActive ? "secondary" : "primary"}
      disabled={busy}
      onClick={() =>
        startTransition(async () => {
          try {
            await setShareActive(shareId, !isActive);
            toast.success(
              t(isActive ? "toastShareDeactivated" : "toastShareActivated"),
            );
            router.refresh();
          } catch (err) {
            if (err instanceof Error && err.message === "UNAUTHORIZED") {
              router.push("/admin/login");
              return;
            }
            toast.error(t("toastActionFailed"));
          }
        })
      }
    >
      {isActive ? t("deactivate") : t("activate")}
    </Button>
  );
}
