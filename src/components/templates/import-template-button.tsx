"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { importTemplateAction } from "@/server/actions/templates";

export function ImportTemplateButton({ shareId }: { shareId: string }) {
  const t = useTranslations("templates");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleImport() {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("shareId", shareId);
      const result = await importTemplateAction(fd);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        setDone(true);
        toast.success(t("importSuccess"));
        // Redirect to templates after a short delay
        setTimeout(() => {
          router.push("/templates");
        }, 1500);
      }
    } catch {
      toast.error(t("importFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleImport} disabled={loading || done} className="gap-2">
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : done ? (
        <Check size={18} />
      ) : (
        <Copy size={18} />
      )}
      {done ? t("imported") : t("useThisTemplate")}
    </Button>
  );
}
