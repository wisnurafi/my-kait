import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { getUserDetail } from "@/server/actions/admin";
import {
  SuspendUserButton,
  DeleteTemplateButton,
} from "@/components/admin/user-detail-actions";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

const logStatusVariant = {
  sent: "success",
  failed: "danger",
  rate_limited: "warning",
  edited: "info",
  deleted: "default",
} as const;

function fmtDate(d: Date, locale: string) {
  return new Date(d).toLocaleString(locale === "en" ? "en-US" : "id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");

  let user;
  try {
    user = await getUserDetail(id);
  } catch {
    notFound();
  }

  const activeShares = user.templates.filter((x) => x.shareActive).length;

  const webhookStatusMeta = {
    active: { variant: "success" as const, label: t("whActive") },
    invalid: { variant: "danger" as const, label: t("whInvalid") },
    rate_limited: { variant: "warning" as const, label: t("whRateLimited") },
    unchecked: { variant: "default" as const, label: t("whUnchecked") },
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs text-fg-secondary hover:text-fg no-underline stagger-in"
      >
        <ArrowLeft size={13} /> {t("usersTitle")}
      </Link>

      {/* Header */}
      <div className="panel p-6 stagger-in">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2>{user.globalName ?? user.username}</h2>
              {user.isSuspended ? (
                <Badge variant="danger">{t("suspended")}</Badge>
              ) : (
                <Badge variant="success">{t("active")}</Badge>
              )}
            </div>
            <p className="font-mono text-xs text-fg-tertiary mt-1.5">
              @{user.username} · {user.discordId}
            </p>
            <p className="text-xs text-fg-secondary mt-1">
              {t("colJoined")}: {fmtDate(user.createdAt, locale)}
            </p>
          </div>
          <SuspendUserButton
            userId={user.id}
            isSuspended={user.isSuspended}
            username={user.username}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[
            [user.templates.length, t("colTemplates")],
            [activeShares, t("statActiveShares")],
            [user.webhooks.length, t("colWebhooks")],
            // recentLogs is capped at 10 — label it as such, not as a total.
            [user.recentLogs.length, t("recentLogs")],
          ].map(([v, label]) => (
            <div key={label as string} className="rounded-lg bg-sunken px-4 py-3">
              <p className="font-display font-bold text-2xl tabular-nums">{v as number}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-secondary mt-1">
                {label as string}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Templates */}
      <div className="panel p-6 stagger-in">
        <h3 className="mb-4">
          {t("colTemplates")} ({user.templates.length})
        </h3>
        {user.templates.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("emptyTemplates")}</p>
        ) : (
          <ul className="space-y-2">
            {user.templates.map((tpl) => (
              <li
                key={tpl.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-ink px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{tpl.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {tpl.shareSlug ? (
                      <Link
                        href={`/t/${tpl.shareSlug}`}
                        target="_blank"
                        className="font-mono text-xs text-accent hover:underline inline-flex items-center gap-1 no-underline"
                      >
                        /t/{tpl.shareSlug} <ExternalLink size={11} />
                      </Link>
                    ) : (
                      <span className="text-xs text-fg-tertiary">—</span>
                    )}
                    {tpl.pendingReports > 0 && (
                      <Badge variant="warning" className="font-mono text-[10px]">
                        {t("reportedTimes", { count: tpl.pendingReports })}
                      </Badge>
                    )}
                  </div>
                </div>
                <DeleteTemplateButton
                  templateId={tpl.id}
                  templateName={tpl.name}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Webhooks */}
      <div className="panel p-6 stagger-in">
        <h3 className="mb-4">
          {t("colWebhooks")} ({user.webhooks.length})
        </h3>
        {user.webhooks.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("emptyWebhooks")}</p>
        ) : (
          <ul className="space-y-2">
            {user.webhooks.map((w) => {
              const meta =
                webhookStatusMeta[
                  w.lastStatus as keyof typeof webhookStatusMeta
                ] ?? webhookStatusMeta.unchecked;
              return (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-ink px-4 py-3"
                >
                  <p className="font-medium truncate">{w.name}</p>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Recent logs */}
      <div className="panel p-6 stagger-in">
        <h3 className="mb-4">{t("recentLogs")}</h3>
        {user.recentLogs.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("emptyLogs")}</p>
        ) : (
          <ul className="space-y-2">
            {user.recentLogs.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 text-sm rounded-lg border border-border-ink px-4 py-2.5"
              >
                <Badge
                  variant={
                    logStatusVariant[l.status as keyof typeof logStatusVariant] ??
                    "default"
                  }
                >
                  {l.status}
                </Badge>
                <span className="text-xs text-fg-tertiary font-mono">
                  {fmtDate(l.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
