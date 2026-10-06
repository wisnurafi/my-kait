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
  searchParams: Promise<{ cat?: string; page?: string }>;
}) {
  const { locale } = await params;
  const { cat, page: rawPage } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const tc = await getTranslations("common");

  const active: AuditCategory = (
    AUDIT_CATEGORIES as readonly string[]
  ).includes(cat ?? "")
    ? (cat as AuditCategory)
    : "all";
  const PAGE_SIZE = 15;
  const requested = Math.max(1, parseInt(rawPage ?? "", 10) || 1);
  const first = await getAuditLogs(active, requested, PAGE_SIZE);
  // Kalau page di URL melebihi total, jatuh ke halaman terakhir.
  const { logs, totalPages } =
    first.page > first.totalPages
      ? await getAuditLogs(active, first.totalPages, PAGE_SIZE)
      : first;
  const page = first.page > first.totalPages ? first.totalPages : first.page;

  const pageHref = (p: number) =>
    active === "all" ? `/admin/audit?page=${p}` : `/admin/audit?cat=${active}&page=${p}`;
  const pagerCls =
    "px-3 py-1.5 rounded-lg no-underline font-mono text-[11px] uppercase tracking-[0.12em] border transition-colors";

  return (
    <div className="space-y-6">
      <div className="stagger-in">
        <div className="label mb-2 cursor-blink">{t("eyebrow")}</div>
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

      <div className="panel overflow-hidden stagger-in p-3 md:p-0">
        {logs.length === 0 ? (
          <p className="p-6 text-sm text-fg-secondary">{t("emptyAudit")}</p>
        ) : (
          <table className="rtable">
            <thead>
              <tr>
                <th>{t("colDate")}</th>
                <th>{t("colAction")}</th>
                <th>{t("colDetail")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const prefix = l.action.split(".")[0] as keyof typeof categoryVariant;
                return (
                  <tr key={l.id}>
                    <td data-label={t("colDate")} className="text-xs text-fg-tertiary whitespace-nowrap font-mono">
                      {fmtDate(l.createdAt, locale)}
                    </td>
                    <td data-label={t("colAction")} className="whitespace-nowrap">
                      <Badge variant={categoryVariant[prefix] ?? "default"}>
                        {l.action}
                      </Badge>
                    </td>
                    <td data-label={t("colDetail")} className="text-fg-secondary">
                      {l.detail ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between stagger-in">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={`${pagerCls} text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong`}>
              ← {tc("prev")}
            </Link>
          ) : (
            <span aria-disabled="true" className={`${pagerCls} text-fg-tertiary border-border-ink opacity-40 cursor-not-allowed`}>
              ← {tc("prev")}
            </span>
          )}
          <span className="text-xs text-fg-tertiary font-mono">
            {t("auditPageOf", { page, totalPages })}
          </span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className={`${pagerCls} text-fg-secondary border-border-ink hover:text-fg hover:border-border-strong`}>
              {tc("next")} →
            </Link>
          ) : (
            <span aria-disabled="true" className={`${pagerCls} text-fg-tertiary border-border-ink opacity-40 cursor-not-allowed`}>
              {tc("next")} →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
