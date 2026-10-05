"use client";

/**
 * Dashboard stats — stat cards, daily bar chart, success donut, top webhooks.
 *
 * Redesign contract: stat-card icon boxes get .hv and .ia.ia-<anim> icons;
 * the daily chart is a responsive viewBox SVG with date ticks every 5 days,
 * 3px minimum bar height, keyboard-navigable bars and a .chart-tip tooltip;
 * the donut arc (.donut-arc) animates on mount via rAF.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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

/* --- Date helpers: parse "YYYY-MM-DD" as local date (no UTC shift) --- */
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

/* --- Shared floating chart tooltip (.chart-tip contract) ---
   Positioning happens in JS (globals.css is off-limits): ChartTip measures
   its own rendered size, then flips/clamps so the tooltip NEVER leaves the
   viewport — regardless of scroll, anchor position, or screen size.
   - bars: centered above the anchor; flips below if the top would clip
   - donut: BESIDE the circle (right by default, vertically centered on it);
     flips left if the right side would clip — never below (the legend lives
     there) and never a centered overlay
   - final pass: hard-clamp into the viewport on both axes
   No tooltip animation exists, so prefers-reduced-motion needs no handling. */
type TipPlacement = "bar" | "donut";

type TipState = {
  content: ReactNode;
  placement: TipPlacement;
  // Anchor + container rects in client (viewport) coords, captured at show()
  // time so scroll is inherently accounted for.
  anchor: { cx: number; cy: number; top: number; bottom: number; left: number; right: number };
  container: { left: number; top: number };
} | null;

function useChartTip() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState>(null);

  const show = (el: Element, content: ReactNode, placement: TipPlacement = "bar") => {
    const c = containerRef.current;
    if (!c) return;
    const r = el.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    setTip({
      content,
      placement,
      anchor: {
        cx: r.left + r.width / 2,
        cy: r.top + r.height / 2,
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
      },
      container: { left: cr.left, top: cr.top },
    });
  };
  const hide = () => setTip(null);
  return { containerRef, tip, show, hide };
}

const TIP_GAP = 12; // px between anchor and tooltip
const TIP_VIEWPORT_MARGIN = 8; // min px between tooltip and viewport edge

function ChartTip({ tip }: { tip: NonNullable<TipState> }) {
  const ref = useRef<HTMLDivElement>(null);
  // Container-relative coords, set after the tooltip measures itself.
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tw = el.offsetWidth;
    const th = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = TIP_VIEWPORT_MARGIN;
    const { anchor, container, placement } = tip;

    let leftV = anchor.cx - tw / 2; // viewport/client coords
    let topV: number;

    if (placement === "donut") {
      // Beside the circle (right by default), vertically centered on it —
      // never below (the legend lives there) and never a centered overlay.
      topV = anchor.cy - th / 2;
      leftV = anchor.right + TIP_GAP;
      // Not enough room on the right but room on the left: flip left
      // (the hard clamp below keeps it inside the viewport as a last resort).
      if (leftV + tw > vw - M && anchor.left - TIP_GAP - tw >= M) {
        leftV = anchor.left - tw - TIP_GAP;
      }
    } else {
      // Bars: above by default, centered on the bar.
      topV = anchor.top - th - TIP_GAP;
      // Would clip the viewport top (e.g. bar near a scrolled-up card):
      // flip below the anchor instead.
      if (topV < M) {
        topV = anchor.bottom + TIP_GAP;
      }
    }

    // Hard clamp into the viewport on both axes — the tooltip can never
    // escape, even if that means it sits slightly off the anchor.
    leftV = Math.max(M, Math.min(vw - tw - M, leftV));
    topV = Math.max(M, Math.min(vh - th - M, topV));

    // Convert viewport coords to container-relative (tooltip is absolutely
    // positioned inside the relative container).
    setPos({ left: leftV - container.left, top: topV - container.top });
  }, [tip]);

  return (
    <div
      ref={ref}
      className="chart-tip"
      role="status"
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        // Hidden until measured so there's no one-frame jump from (0,0).
        visibility: pos ? "visible" : "hidden",
      }}
    >
      {tip.content}
    </div>
  );
}

/** Tooltip body: date row + Terkirim/Gagal/Total + success-rate foot. */
function TipRows({
  date,
  sent,
  failed,
  total,
}: {
  date: ReactNode;
  sent: number;
  failed: number;
  total: number;
}) {
  const t = useTranslations("dashboard");
  const rate = total > 0 ? Math.round((sent / total) * 100) : 0;
  return (
    <>
      <div className="tt-date">{date}</div>
      <div className="tt-row">
        <span>{t("chart.sent")}</span>
        <b className="ok">{sent}</b>
      </div>
      <div className="tt-row">
        <span>{t("chart.failed")}</span>
        <b className="err">{failed}</b>
      </div>
      <div className="tt-row">
        <span>{t("chart.total")}</span>
        <b>{total}</b>
      </div>
      <div className="tt-foot">
        <span>{t("chart.successRate")}</span>
        <b>{rate}%</b>
      </div>
    </>
  );
}

/* --- 3 count cards: mono big number, micro label, animated icon box --- */
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
    ia: string;
    hint?: string;
  }[] = [
    { label: t("webhooksCount"), value: webhooks, suffix: "", icon: Link2, ia: "ia-swing" },
    { label: t("messagesSent"), value: sent, suffix: "", icon: SendHorizontal, ia: "ia-launch" },
    {
      label: t("successRate"),
      value: successRate,
      suffix: "%",
      icon: TrendingUp,
      ia: "ia-eq",
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
            ia={s.ia}
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
  ia,
  index,
  hint,
}: {
  label: string;
  value: number;
  suffix: string;
  icon: typeof Link2;
  ia: string;
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
            <span className="text-2xl text-fg-secondary ml-1">{suffix}</span>
          </div>
        </div>
        <div className="hv rounded-lg p-2.5 bg-sunken border border-border-ink shrink-0">
          <span className={cn("ia", ia)}>
            <Icon size={20} className="text-accent" />
          </span>
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

/* --- Messages per day: responsive SVG stacked bars with tooltip --- */
function DailyChart({ daily }: { daily: DailyStat[] }) {
  const t = useTranslations("dashboard");
  const { containerRef, tip, show, hide } = useChartTip();
  const barsRef = useRef<SVGGElement[]>([]);
  const [active, setActive] = useState<number | null>(null);

  const fullDate = (iso: string) => {
    const dt = parseLocalDate(iso);
    const day = t(`chart.days.${DAY_KEYS[dt.getDay()]}`);
    const month = t(`chart.months.${MONTH_KEYS[dt.getMonth()]}`);
    return `${day}, ${dt.getDate()} ${month} ${dt.getFullYear()}`;
  };

  const W = 600;
  const H = 170;
  const pL = 6;
  const pR = 6;
  const pT = 12;
  const pB = 26;
  const pw = W - pL - pR;
  const ph = H - pT - pB;
  const yb = pT + ph;
  const max = Math.max(1, ...daily.map((d) => d.total));
  const slot = pw / daily.length;
  const bw = Math.min(14, slot * 0.68);

  const onBarKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const bars = barsRef.current;
      const i = bars.indexOf(document.activeElement as SVGGElement);
      const n = e.key === "ArrowRight" ? i + 1 : i - 1;
      if (bars[n]) {
        e.preventDefault();
        bars[n].focus();
      }
    } else if (e.key === "Escape") {
      hide();
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  };

  const showBar = (el: Element, d: DailyStat, i: number) => {
    setActive(i);
    const label = fullDate(d.date);
    show(el, <TipRows date={label} sent={d.sent} failed={d.failed} total={d.total} />);
  };
  const hideBar = () => {
    setActive(null);
    hide();
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2 flex-wrap mb-4">
        <div>
          <h3 className="text-lg">{t("stats.perDay")}</h3>
          <p className="text-[11px] text-fg-tertiary mt-0.5">
            {t("stats.last30days")} · {t("chart.tipHint")}
          </p>
        </div>
        <div className="flex gap-4 text-xs text-fg-secondary">
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
      {daily.every((d) => d.total === 0) ? (
        <p className="text-sm text-fg-secondary py-8 text-center">{t("stats.noData")}</p>
      ) : (
        <div ref={containerRef} className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto block"
            role="group"
            aria-label={t("stats.perDay")}
          >
            {[0, 1, 2, 3].map((g) => (
              <line
                key={g}
                x1={pL}
                y1={pT + (ph * g) / 3}
                x2={W - pR}
                y2={pT + (ph * g) / 3}
                stroke="var(--border)"
                strokeWidth={1}
              />
            ))}
            {daily.map((d, i) => {
              // Stacked: failed at the base, sent on top; 3px min so quiet days stay visible
              const fhF = d.failed > 0 ? Math.max(3, (d.failed / max) * ph) : 0;
              const fhS = d.sent > 0 ? Math.max(3, (d.sent / max) * ph) : 0;
              const x = pL + i * slot + (slot - bw) / 2;
              const label = fullDate(d.date);
              const dt = parseLocalDate(d.date);
              return (
                <g key={d.date}>
                  <g
                    ref={(el) => {
                      if (el) barsRef.current[i] = el;
                    }}
                    tabIndex={0}
                    role="img"
                    aria-label={t("chart.barAria", {
                      date: label,
                      sent: d.sent,
                      failed: d.failed,
                    })}
                    className="bar"
                    style={{
                      cursor: "pointer",
                      outline: "none",
                      filter: active === i ? "brightness(1.35)" : undefined,
                    }}
                    onMouseEnter={(e) => showBar(e.currentTarget, d, i)}
                    onMouseLeave={hideBar}
                    onFocus={(e) => showBar(e.currentTarget, d, i)}
                    onBlur={hideBar}
                    onKeyDown={onBarKeyDown}
                  >
                    {fhF > 0 && (
                      <rect
                        x={x}
                        y={yb - fhF}
                        width={bw}
                        height={fhF}
                        rx={2.5}
                        fill="var(--error)"
                        opacity={0.8}
                      />
                    )}
                    {fhS > 0 && (
                      <rect
                        x={x}
                        y={yb - fhF - fhS}
                        width={bw}
                        height={fhS}
                        rx={2.5}
                        fill="var(--accent-primary)"
                        opacity={0.9}
                      />
                    )}
                  </g>
                  {i % 5 === 0 && (
                    <text
                      x={pL + i * slot + slot / 2}
                      y={H - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fill="var(--fg-tertiary)"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      {`${dt.getDate()}/${dt.getMonth() + 1}`}
                    </text>
                  )}
                </g>
              );
            })}
            <line
              x1={pL}
              y1={yb}
              x2={W - pR}
              y2={yb}
              stroke="var(--border)"
              strokeWidth={1}
            />
          </svg>
          {tip && <ChartTip tip={tip} />}
        </div>
      )}
    </Card>
  );
}

/* --- Most active webhooks: horizontal HTML bars with tooltip --- */
function WebhookChart({ webhooks }: { webhooks: WebhookStat[] }) {
  const t = useTranslations("dashboard");
  const { containerRef, tip, show, hide } = useChartTip();
  const max = Math.max(1, ...webhooks.map((w) => w.total));

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-lg">{t("stats.topWebhooks")}</h3>
        <p className="text-[11px] text-fg-tertiary mt-0.5">
          {t("stats.last30days")} · {t("chart.whTipHint")}
        </p>
      </div>
      {webhooks.length === 0 ? (
        <p className="text-sm text-fg-secondary py-8 text-center">{t("stats.noData")}</p>
      ) : (
        <div ref={containerRef} className="relative space-y-2">
          {webhooks.map((w) => {
            const rate = w.total > 0 ? Math.round((w.sent / w.total) * 100) : 0;
            return (
              <div
                key={w.webhookId ?? w.name}
                tabIndex={0}
                role="img"
                aria-label={t("chart.whRowAria", {
                  name: w.name,
                  total: w.total,
                  failed: w.failed,
                  rate,
                })}
                className="hv rounded-lg px-2 -mx-2 py-1.5 cursor-default focus-ring"
                onMouseEnter={(e) =>
                  show(
                    e.currentTarget,
                    <TipRows date={w.name} sent={w.sent} failed={w.failed} total={w.total} />,
                  )
                }
                onMouseLeave={hide}
                onFocus={(e) =>
                  show(
                    e.currentTarget,
                    <TipRows date={w.name} sent={w.sent} failed={w.failed} total={w.total} />,
                  )
                }
                onBlur={hide}
              >
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
            );
          })}
          {tip && <ChartTip tip={tip} />}
        </div>
      )}
    </Card>
  );
}

/* --- Success rate: donut with animated arc on mount --- */
function SuccessDonut({
  rate,
  sent,
  failed,
}: {
  rate: number;
  sent: number;
  failed: number;
}) {
  const t = useTranslations("dashboard");
  const { containerRef, tip, show, hide } = useChartTip();
  const R = 54;
  const C = 2 * Math.PI * R;
  const target = C - (rate / 100) * C;
  const [offset, setOffset] = useState(C);

  // Animate the arc from empty to the target on mount (rAF lets the
  // .donut-arc CSS transition do the easing); skip for reduced motion.
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setOffset(target);
      return;
    }
    let raf = 0;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => setOffset(target));
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <Card className="p-5 flex flex-col">
      <h3 className="text-lg mb-4">{t("stats.successRate")}</h3>
      {/* Donut block vertically centered in the stretched panel so the
          card doesn't end with dead space when the chart panel is taller. */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div ref={containerRef} className="relative">
        <svg
          width={140}
          height={140}
          viewBox="0 0 140 140"
          tabIndex={0}
          role="img"
          aria-label={t("chart.donutAria", { rate, sent, failed })}
          className="hv block cursor-pointer rounded-full focus-ring"
          onMouseEnter={(e) =>
            show(
              e.currentTarget,
              <TipRows
                date={t("stats.last30days")}
                sent={sent}
                failed={failed}
                total={sent + failed}
              />,
              "donut",
            )
          }
          onMouseLeave={hide}
          onFocus={(e) =>
            show(
              e.currentTarget,
              <TipRows
                date={t("stats.last30days")}
                sent={sent}
                failed={failed}
                total={sent + failed}
              />,
              "donut",
            )
          }
          onBlur={hide}
        >
          <circle
            cx={70}
            cy={70}
            r={R}
            fill="none"
            strokeWidth={14}
            stroke="var(--surface-sunken)"
          />
          <circle
            className="donut-arc"
            cx={70}
            cy={70}
            r={R}
            fill="none"
            strokeWidth={14}
            stroke="var(--accent-primary)"
            strokeDasharray={C}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-mono text-3xl tabular-nums">{rate}%</span>
        </div>
        {tip && <ChartTip tip={tip} />}
        </div>
          <div className="flex gap-4 mt-4 text-xs">
          <span className="font-mono text-success">✓ {sent}</span>
          <span className="font-mono text-error">✗ {failed}</span>
        </div>
        <p className="text-[11px] text-fg-tertiary mt-2">{t("stats.last30days")}</p>
      </div>
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
