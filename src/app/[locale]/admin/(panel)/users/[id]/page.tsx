import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import {
  getUserDetail,
  getUserScheduled,
  getUserApiKeys,
} from "@/server/actions/admin";
import {
  SuspendUserButton,
  DeleteTemplateButton,
  CancelScheduledButton,
  RevokeApiKeyButton,
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

  // Loaded after the user exists; requireAdmin failures surface via error.tsx.
  const [scheduled, apiKeyList] = await Promise.all([
    getUserScheduled(id),
    getUserApiKeys(id),
  ]);

  const activeShares = user.templates.filter((x) => x.shareActive).length;
  const pendingReports = user.templates.reduce(
    (sum, x) => sum + x.pendingReports,
    0,
  );
  const pendingScheduled = scheduled.filter(
    (s) => s.status === "pending" || s.status === "sending",
  ).length;
  const activeKeys = apiKeyList.filter((k) => !k.revokedAt).length;
  const lastActive = user.recentLogs[0]?.createdAt ?? null;

  const webhookStatusMeta = {
    active: { variant: "success" as const, label: t("whActive") },
    invalid: { variant: "danger" as const, label: t("whInvalid") },
    rate_limited: { variant: "warning" as const, label: t("whRateLimited") },
    unchecked: { variant: "default" as const, label: t("whUnchecked") },
  };

  const schedStatusMeta = {
    pending: { variant: "warning" as const, label: t("schedPending") },
    sending: { variant: "info" as const, label: t("schedSending") },
    sent: { variant: "success" as const, label: t("schedSent") },
    failed: { variant: "danger" as const, label: t("schedFailed") },
    cancelled: { variant: "default" as const, label: t("schedCancelled") },
  };

  const recurrenceLabel = {
    none: t("recOnce"),
    daily: t("recDaily"),
    weekly: t("recWeekly"),
    monthly: t("recMonthly"),
  } as const;

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
              {lastActive && (
                <>
                  {" "}· {t("colLastActive")}: {fmtDate(lastActive, locale)}
                </>
              )}
            </p>
          </div>
          <SuspendUserButton
            userId={user.id}
            isSuspended={user.isSuspended}
            username={user.username}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          {[
            [user.templates.length, t("colTemplates")],
            [user.webhooks.length, t("colWebhooks")],
            [activeShares, t("statActiveShares")],
            [pendingScheduled, t("statSchedPending")],
            [activeKeys, t("statActiveKeys")],
            [pendingReports, t("statPendingReports")],
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
                    <span className="text-xs text-fg-tertiary font-mono">
                      {fmtDate(tpl.createdAt, locale)}
                    </span>
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
                  <div className="min-w-0">
                    <p className="font-medium truncate">{w.name}</p>
                    <p className="text-xs text-fg-tertiary font-mono mt-0.5">
                      {t("colCreated")}: {fmtDate(w.createdAt, locale)}
                    </p>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Scheduled */}
      <div className="panel p-6 stagger-in">
        <h3 className="mb-4">
          {t("colScheduled")} ({scheduled.length})
        </h3>
        {scheduled.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("emptyScheduled")}</p>
        ) : (
          <ul className="space-y-2">
            {scheduled.map((s) => {
              const meta =
                schedStatusMeta[
                  s.status as keyof typeof schedStatusMeta
                ] ?? schedStatusMeta.pending;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border-ink px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{s.webhookName}</p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-fg-tertiary font-mono">
                        {fmtDate(s.scheduledAt, locale)}
                      </span>
                      <Badge
                        variant={s.recurrence === "none" ? "default" : "info"}
                        className="font-mono text-[10px]"
                      >
                        {
                          recurrenceLabel[
                            s.recurrence as keyof typeof recurrenceLabel
                          ]
                        }
                      </Badge>
                      {s.attempts > 0 && (
                        <span className="text-xs text-fg-tertiary font-mono">
                          {t("attemptsLabel", { count: s.attempts })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {s.status === "pending" && (
                      <CancelScheduledButton
                        scheduledId={s.id}
                        webhookName={s.webhookName}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* API keys */}
      <div className="panel p-6 stagger-in">
        <h3 className="mb-4">
          {t("colApiKeys")} ({apiKeyList.length})
        </h3>
        {apiKeyList.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("emptyApiKeys")}</p>
        ) : (
          <ul className="space-y-2">
            {apiKeyList.map((k) => (
              <li
                key={k.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border-ink px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">
                    {k.name}{" "}
                    <code className="font-mono text-xs text-fg-tertiary">
                      {k.keyPrefix}…
                    </code>
                  </p>
                  <p className="text-xs text-fg-tertiary mt-1">
                    {t("colLastUsed")}:{" "}
                    {k.lastUsedAt
                      ? fmtDate(k.lastUsedAt, locale)
                      : t("keyNeverUsed")}{" "}
                    · {t("colExpires")}:{" "}
                    {k.expiresAt ? fmtDate(k.expiresAt, locale) : t("keyNoExpiry")}
                  </p>
                </div>
                <div className="shrink-0">
                  {k.revokedAt ? (
                    <Badge variant="default">{t("keyRevoked")}</Badge>
                  ) : (
                    <RevokeApiKeyButton keyId={k.id} keyName={k.name} />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Recent logs */}
      <div className="panel p-6 stagger-in">
        <h3 className="mb-4">{t("recentLogs")}</h3>
        {user.recentLogs.length === 0 ? (
          <p className="text-sm text-fg-secondary">{t("emptyLogs")}</p>
        ) : (
          <table className="rtable">
            <thead>
              <tr>
                <th>{t("colStatus")}</th>
                <th>{t("colDate")}</th>
              </tr>
            </thead>
            <tbody>
              {user.recentLogs.map((l) => (
                <tr key={l.id}>
                  <td data-label={t("colStatus")}>
                    <Badge
                      variant={
                        logStatusVariant[l.status as keyof typeof logStatusVariant] ??
                        "default"
                      }
                    >
                      {l.status}
                    </Badge>
                  </td>
                  <td
                    data-label={t("colDate")}
                    className="text-xs text-fg-tertiary font-mono"
                  >
                    {fmtDate(l.createdAt, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
