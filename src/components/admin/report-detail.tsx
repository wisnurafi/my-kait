"use client";

/**
 * Report detail dialog — shows the full report (reporter, target,
 * complete reason, date, status) in a centered modal. The reason column
 * in the queue is clamped, so long reasons stay readable here.
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogBody } from "@/components/ui/dialog";
import { Eye, ExternalLink } from "lucide-react";

export type ReportDetailData = {
  templateName: string;
  templateSlug: string | null;
  reporterName: string;
  reporterId: string | null;
  reason: string;
  dateLabel: string;
  statusLabel: string;
  statusVariant: "warning" | "info" | "default" | "success";
  reportCount: number;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-border-ink last:border-0">
      <dt className="w-24 shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-tertiary pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-fg">{children}</dd>
    </div>
  );
}

export function ReportDetailButton({ report }: { report: ReportDetailData }) {
  const t = useTranslations("admin");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label={t("reportDetailTitle")}
        className="hv gap-1"
      >
        <Eye size={14} />
        <span>{t("colDetail")}</span>
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="max-w-xl"
      >
        <DialogTitle>{t("reportDetailTitle")}</DialogTitle>
        <DialogBody className="max-h-[80vh] overflow-y-auto">
          <dl>
            <Row label={t("colTemplate")}>
              <span className="font-medium">{report.templateName}</span>
              {report.templateSlug && (
                <Link
                  href={`/t/${report.templateSlug}`}
                  target="_blank"
                  title={t("viewTemplate")}
                  className="font-mono text-xs text-accent hover:underline inline-flex items-center gap-1 no-underline ml-2"
                >
                  /t/{report.templateSlug} <ExternalLink size={11} />
                </Link>
              )}
            </Row>
            <Row label={t("colReporter")}>
              {report.reporterId ? (
                <Link
                  href={`/admin/users/${report.reporterId}`}
                  className="no-underline hover:text-fg hover:underline text-fg-secondary"
                >
                  {report.reporterName}
                </Link>
              ) : (
                <span className="text-fg-secondary">{report.reporterName}</span>
              )}
            </Row>
            <Row label={t("colDate")}>
              <span className="font-mono text-xs text-fg-secondary">
                {report.dateLabel}
              </span>
            </Row>
            <Row label={t("colStatus")}>
              <Badge variant={report.statusVariant}>{report.statusLabel}</Badge>
              {report.reportCount > 1 && (
                <Badge variant="warning" className="font-mono text-[10px] ml-1.5">
                  {t("reportedTimes", { count: report.reportCount })}
                </Badge>
              )}
            </Row>
            <Row label={t("colReason")}>
              <p className="whitespace-pre-wrap break-words text-sm">
                {report.reason}
              </p>
            </Row>
          </dl>
        </DialogBody>
      </Dialog>
    </>
  );
}
