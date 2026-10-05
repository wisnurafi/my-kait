"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useFormatter } from "next-intl";
import { getPingHistory } from "@/server/actions/webhooks";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";

type PingStatus = "active" | "invalid" | "rate_limited" | "error" | "unchecked";

export function PingHistory({ webhookId }: { webhookId: string }) {
  const t = useTranslations("ping");
  const tw = useTranslations("webhooks");
  const format = useFormatter();
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getPingHistory>> | null>(null);

  useEffect(() => {
    getPingHistory(webhookId).then(setHistory);
  }, [webhookId]);

  if (!history) {
    return (
      <div className="mt-4 pt-4 border-t border-border-ink flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="mt-4 pt-4 border-t border-border-ink">
        <p className="text-sm text-fg-secondary text-center py-4">{t("noHistory")}</p>
      </div>
    );
  }

  const statusVariant: Record<PingStatus, "success" | "danger" | "warning" | "default"> = {
    active: "success",
    invalid: "danger",
    rate_limited: "warning",
    error: "danger",
    unchecked: "default",
  };

  return (
    <div className="mt-4 pt-4 border-t border-border-ink">
      <h4 className="text-sm font-bold mb-3 font-display uppercase tracking-[0.05em]">{t("history")}</h4>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {history.map((check) => (
          <div key={check.id} className="flex items-center justify-between text-sm py-2 px-3 bg-sunken border border-border-ink rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant[check.status as PingStatus]}>
                {tw(`status.${check.status}`)}
              </Badge>
              {check.httpStatus && (
                <span className="text-fg-secondary text-xs">HTTP {check.httpStatus}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-fg-secondary">
              {check.latencyMs != null && (
                <span>{t("latency")}: {check.latencyMs}ms</span>
              )}
              <span>{format.dateTime(check.createdAt, { dateStyle: "short", timeStyle: "short" })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
