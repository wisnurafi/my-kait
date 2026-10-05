"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { Link2, SendHorizontal, TrendingUp } from "lucide-react";
import type { DailyStat, WebhookStat } from "@/server/actions/stats";

/* --- Animated count-up: rAF, easeOutCubic, 800ms --- */
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

/* --- 3 count cards: mono big number, micro label, plain icon box --- */
export function StatCards({
  webhooks,
  sent,
  successRate,
  caption,
}: {
  webhooks: number;
  sent: number;
  successRate: number;
  caption?: string;
}) {
  const t = useTranslations("dashboard");
  const stats: {
    label: string;
    value: number;
    suffix: string;
    icon: typeof Link2;
    hint?: string;
  }[] = [
    { label: t("webhooksCount"), value: webhooks, suffix: "", icon: Link2 },
    { label: t("messagesSent"), value: sent, suffix: "", icon: SendHorizontal },
    {
      label: t("successRate"),
      value: successRate,
      suffix: "%",
      icon: TrendingUp,
      hint: t("successRateHint"),
    },
  ];
  return (
    <div className="space-y-2">
      {caption && <p className="text-[11px] text-fg-tertiary">{caption}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((s, i) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            suffix={s.suffix}
            icon={s.icon}
            index={i}
            hint={s.hint}
          />
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  index,
  hint,
}: {
  label: string;
  value: number;
  suffix: string;
  icon: typeof Link2;
  index: number;
  hint?: string;
}) {
  const count = useCountUp(value);
  const card = (
    <Card className={hint ? "p-5 cursor-help" : "p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label mb-2">{label}</div>
          <div className="font-mono text-4xl tabular-nums text-fg">
            {count}
            <span className="text-lg text-fg-tertiary">{suffix}</span>
          </div>
        </div>
        <div className="rounded-lg p-2.5 bg-sunken border border-border-ink shrink-0">
          <Icon size={20} className="text-accent" />
        </div>
      </div>
    </Card>
  );
  return (
    <div className="stagger-in" style={{ "--stagger-index": index } as CSSProperties}>
      {hint ? (
        <Tooltip content={hint} position="bottom">
          {card}
        </Tooltip>
      ) : (
        card
      )}
    </div>
  );
}

/* --- Messages per day: SVG stacked bar chart (solid colors) --- */
function DailyChart({ daily }: { daily: DailyStat[] }) {
  const t = useTranslations("dashboard");
  const max = Math.max(1, ...daily.map((d) => d.total));
  const W = 600;
  const H = 140;
  const barW = W / daily.length;

  return (
    <Card className="p-5">
      <h3 className="text-lg mb-4">{t("stats.perDay")}</h3>
      {daily.every((d) => d.total === 0) ? (
        <p className="text-sm text-fg-secondary py-8 text-center">{t("stats.noData")}</p>
      ) : (
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t("stats.perDay")}>
            {daily.map((d, i) => {
              const h = Math.max(2, (d.total / max) * (H - 24));
              const sentH = (d.sent / Math.max(1, d.total)) * h;
              return (
                <g key={d.date}>
                  <title>{`${d.date}: ${d.total}`}</title>
                  <rect
                    x={i * barW + 1}
                    y={H - 20 - h}
                    width={barW - 2}
                    height={h}
                    rx={2}
                    fill="var(--error)"
                    opacity={0.75}
                  />
                  <rect
                    x={i * barW + 1}
                    y={H - 20 - sentH}
                    width={barW - 2}
                    height={sentH}
                    rx={2}
                    fill="var(--accent-primary)"
                    opacity={0.9}
                  />
                </g>
              );
            })}
            <line x1={0} y1={H - 20} x2={W} y2={H - 20} stroke="var(--border)" strokeWidth={1} />
          </svg>
          <div className="flex justify-between text-[10px] font-mono text-fg-tertiary mt-1">
            <span>{daily[0]?.date.slice(5)}</span>
            <span>{daily[daily.length - 1]?.date.slice(5)}</span>
          </div>
          <div className="flex gap-4 mt-3 text-xs text-fg-secondary">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-accent" />
              {t("stats.sent")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-error" />
              {t("stats.failed")}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

/* --- Most active webhooks: horizontal bars --- */
function WebhookChart({ webhooks }: { webhooks: WebhookStat[] }) {
  const t = useTranslations("dashboard");
  const max = Math.max(1, ...webhooks.map((w) => w.total));

  return (
    <Card className="p-5">
      <h3 className="text-lg mb-4">{t("stats.topWebhooks")}</h3>
      {webhooks.length === 0 ? (
        <p className="text-sm text-fg-secondary py-8 text-center">{t("stats.noData")}</p>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w, i) => (
            <div key={w.webhookId ?? w.name} className="stagger-in" style={{ "--stagger-index": i } as CSSProperties}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-semibold truncate max-w-[60%]">{w.name}</span>
                <span className="font-mono text-fg-secondary">
                  {w.total}
                  {w.failed > 0 && <span className="text-error"> · {w.failed} ✗</span>}
                </span>
              </div>
              <div className="h-3 rounded-md bg-sunken border border-border-ink overflow-hidden">
                <div
                  className="h-full rounded-md bg-accent"
                  style={{ width: `${(w.total / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* --- Success rate: donut (solid lime arc) --- */
function SuccessDonut({ rate, sent, failed }: { rate: number; sent: number; failed: number }) {
  const t = useTranslations("dashboard");
  const R = 54;
  const C = 2 * Math.PI * R;
  const offset = C - (rate / 100) * C;

  return (
    <Card className="p-5 flex flex-col items-center">
      <h3 className="text-lg mb-4 self-start">{t("stats.successRate")}</h3>
      <div className="relative">
        <svg width={140} height={140} viewBox="0 0 140 140">
          <circle cx={70} cy={70} r={R} fill="none" strokeWidth={14}
            stroke="var(--surface-sunken)" />
          <circle cx={70} cy={70} r={R} fill="none" strokeWidth={14}
            stroke="var(--accent-primary)"
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-3xl tabular-nums">{rate}%</span>
        </div>
      </div>
      <div className="flex gap-4 mt-4 text-xs">
        <span className="font-mono text-success">✓ {sent}</span>
        <span className="font-mono text-error">✗ {failed}</span>
      </div>
      <p className="text-[11px] text-fg-tertiary mt-2">{t("stats.last30days")}</p>
    </Card>
  );
}

export function DashboardStats({
  daily,
  webhooks,
  successRate,
  sent,
  failed,
}: {
  daily: DailyStat[];
  webhooks: WebhookStat[];
  successRate: number;
  sent: number;
  failed: number;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 stagger-in" style={{ "--stagger-index": 3 } as CSSProperties}>
        <DailyChart daily={daily} />
      </div>
      <div className="stagger-in" style={{ "--stagger-index": 4 } as CSSProperties}>
        <SuccessDonut rate={successRate} sent={sent} failed={failed} />
      </div>
      <div className="lg:col-span-3 stagger-in" style={{ "--stagger-index": 5 } as CSSProperties}>
        <WebhookChart webhooks={webhooks} />
      </div>
    </div>
  );
}
