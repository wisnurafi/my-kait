import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import {
  getAuditLogs,
  type AuditCategory,
} from "@/server/actions/admin";
import { cn } from "@/lib/utils";

const AUDIT_CATEGORIES: AuditCategory[] = [
  "all",
  "report",
  "share",
  "template",
  "user",
  "admin",
];

const categoryVariant = {
  report: "warning",
  share: "info",
  template: "danger",
  user: "danger",
  admin: "default",
} as const;

function fmtDate(d: Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { locale } = await params;
  const { cat } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  const active: AuditCategory = (
    AUDIT_CATEGORIES as readonly string[]
  ).includes(cat ?? "")
    ? (cat as AuditCategory)
    : "all";
  const logs = await getAuditLogs(active);

  return (
    <div className="space-y-6">
      <div className="stagger-in">
        <div className="label mb-2">{t("eyebrow")}</div>
        <h2>{t("auditTitle")}</h2>
        <p className="text-sm text-fg-secondary mt-1">{t("auditSubtitle")}</p>
      </div>

      <div className="flex gap-1.5 flex-wrap stagger-in">
        {AUDIT_CATEGORIES.map((c) => (
          <Link
            key={c}
            href={c === "all" ? "/admin/audit" : `/admin/audit?cat=${c}`}
            className={cn(
              "px-3 py-1.5 rounded-lg no-underline font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors",
              active === c
                ? "bg-accent-soft text-accent border-accent/30"
                : "text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong",
            )}
          >
            {t(`auditFilter${c[0].toUpperCase()}${c.slice(1)}`)}
          </Link>
        ))}
      </div>

      <div className="panel overflow-hidden stagger-in">
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyAudit")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-tertiary text-left">
                  <th className="px-4 py-3 font-medium">{t("colDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("colAction")}</th>
                  <th className="px-4 py-3 font-medium">{t("colDetail")}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const prefix = l.action.split(".")[0] as keyof typeof categoryVariant;
                  return (
                    <tr
                      key={l.id}
                      className="border-t border-border-ink hover:bg-surface-hover/50"
                    >
                      <td className="px-4 py-3 text-xs text-fg-tertiary whitespace-nowrap font-mono">
                        {fmtDate(l.createdAt, locale)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={categoryVariant[prefix] ?? "default"}>
                          {l.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-fg-secondary">
                        {l.detail ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.length >= 200 && (
        <p className="text-xs text-fg-tertiary font-mono">{t("limitNote")}</p>
      )}
    </div>
  );
}
