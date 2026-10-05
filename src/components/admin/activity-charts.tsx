"use client";

/**
 * Admin activity charts — interactive SVG bar charts.
 *
 * Same interaction pattern as the user dashboard's DailyChart:
 * - each bar is a focusable <g tabindex="0" role="img"> with an aria-label
 * - hover / focus shows a shared .chart-tip tooltip (full date + sent /
 *   failed / total / success rate, or new users)
 * - ArrowLeft/ArrowRight move focus between bars, Escape dismisses
 * - axis ticks every 5 days, minimum bar height 3px so quiet days stay visible
 */

import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import type { AdminDaily } from "@/server/actions/admin";

const W = 600;
const H = 170;
const PL = 6;
const PR = 6;
const PT = 12;
const PB = 26;
const PW = W - PL - PR;
const PH = H - PT - PB;
const BASE = PT + PH;
const MIN_H = 3;

type Mode = "stacked" | "single";

type BarGeom = {
  x: number;
  cx: number;
  top: number;
  h: number;
  failH: number;
  sentH: number;
};

function BarChart({
  daily,
  mode,
  ariaLabel,
}: {
  daily: AdminDaily[];
  mode: Mode;
  ariaLabel: string;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const tag = locale === "en" ? "en-US" : "id-ID";
  const [tip, setTip] = useState<number | null>(null);
  const barsRef = useRef<Array<SVGGElement | null>>([]);

  const fullDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(tag, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const tickLabel = (iso: string) => {
    const [, m, d] = iso.split("-");
    return `${Number(d)}/${Number(m)}`;
  };

  if (daily.length === 0) {
    return (
      <p className="text-sm text-fg-secondary py-8 text-center">{t("noData")}</p>
    );
  }

  const max = Math.max(
    1,
    ...daily.map((d) => (mode === "stacked" ? d.sent + d.failed : d.users)),
  );
  const slot = PW / daily.length;
  const bw = Math.min(14, slot * 0.68);

  const geoms: BarGeom[] = daily.map((d, i) => {
    const x = PL + i * slot + (slot - bw) / 2;
    let failH = 0;
    let sentH = 0;
    let h: number;
    if (mode === "stacked") {
      failH = d.failed > 0 ? Math.max(MIN_H, (d.failed / max) * PH) : 0;
      sentH = d.sent > 0 ? Math.max(MIN_H, (d.sent / max) * PH) : 0;
      h = failH + sentH;
    } else {
      h = d.users > 0 ? Math.max(MIN_H, (d.users / max) * PH) : 0;
    }
    return { x, cx: x + bw / 2, top: BASE - h, h, failH, sentH };
  });

  const onBarKeyDown = (e: React.KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const n = e.key === "ArrowRight" ? i + 1 : i - 1;
      const el = barsRef.current[n];
      if (el) {
        e.preventDefault();
        el.focus();
      }
    } else if (e.key === "Escape") {
      setTip(null);
      e.currentTarget.blur();
    }
  };

  const tipDatum = tip !== null ? daily[tip] : null;
  const tipGeom = tip !== null ? geoms[tip] : null;
  // Tooltip sits above the bar; flip below when the bar top is near the top.
  const flipBelow = tipGeom !== null && tipGeom.top / H < 0.42;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="group"
        aria-label={ariaLabel}
      >
        {daily.map((d, i) => {
          const g = geoms[i];
          const aria =
            mode === "stacked"
              ? `${fullDate(d.date)}: ${d.sent} ${t("sent")}, ${d.failed} ${t("failed")}`
              : `${fullDate(d.date)}: ${d.users} ${t("chartUsersNew")}`;
          return (
            <g
              key={d.date}
              ref={(el) => {
                barsRef.current[i] = el;
              }}
              className="bar"
              tabIndex={0}
              role="img"
              aria-label={aria}
              onMouseEnter={() => setTip(i)}
              onMouseLeave={() => setTip(null)}
              onFocus={() => setTip(i)}
              onBlur={() => setTip(null)}
              onKeyDown={(e) => onBarKeyDown(e, i)}
            >
              {mode === "stacked" ? (
                <>
                  {g.failH > 0 && (
                    <rect
                      x={g.x}
                      y={BASE - g.failH}
                      width={bw}
                      height={g.failH}
                      rx={2.5}
                      fill="var(--error)"
                      opacity={0.75}
                    />
                  )}
                  {g.sentH > 0 && (
                    <rect
                      x={g.x}
                      y={BASE - g.failH - g.sentH}
                      width={bw}
                      height={g.sentH}
                      rx={2.5}
                      fill="var(--accent-primary)"
                      opacity={0.9}
                    />
                  )}
                </>
              ) : (
                g.h > 0 && (
                  <rect
                    x={g.x}
                    y={g.top}
                    width={bw}
                    height={g.h}
                    rx={2.5}
                    fill="var(--accent-sky)"
                    opacity={0.85}
                  />
                )
              )}
              {i % 5 === 0 && (
                <text
                  x={g.cx}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-fg-tertiary font-mono"
                >
                  {tickLabel(d.date)}
                </text>
              )}
            </g>
          );
        })}
        <line
          x1={0}
          y1={BASE}
          x2={W}
          y2={BASE}
          stroke="var(--border)"
          strokeWidth={1}
        />
      </svg>

      {tipDatum && tipGeom && (
        <div
          className="chart-tip"
          role="status"
          style={{
            left: `${(tipGeom.cx / W) * 100}%`,
            top: `${(tipGeom.top / H) * 100}%`,
            transform: flipBelow
              ? "translate(-50%, 10px)"
              : "translate(-50%, -115%)",
          }}
        >
          <div className="tt-date">{fullDate(tipDatum.date)}</div>
          {mode === "stacked" ? (
            <>
              <div className="tt-row">
                <span>{t("sent")}</span>
                <b className="ok">{tipDatum.sent}</b>
              </div>
              <div className="tt-row">
                <span>{t("failed")}</span>
                <b className="err">{tipDatum.failed}</b>
              </div>
              <div className="tt-row">
                <span>{t("chartTotal")}</span>
                <b>{tipDatum.sent + tipDatum.failed}</b>
              </div>
              <div className="tt-foot">
                <span>{t("chartSuccessRate")}</span>
                <b>
                  {tipDatum.sent + tipDatum.failed > 0
                    ? Math.round(
                        (tipDatum.sent /
                          (tipDatum.sent + tipDatum.failed)) *
                          100,
                      )
                    : 0}
                  %
                </b>
              </div>
            </>
          ) : (
            <div className="tt-row">
              <span>{t("chartUsersNew")}</span>
              <b style={{ color: "var(--accent-sky)" }}>{tipDatum.users}</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessagesChart({ daily }: { daily: AdminDaily[] }) {
  const t = useTranslations("admin");
  const empty = daily.every((d) => d.sent + d.failed === 0);
  return (
    <Card className="p-5">
      <h3 className="text-lg mb-1">{t("chartMessages")}</h3>
      <p className="text-xs text-fg-tertiary mb-4">{t("chartHint")}</p>
      {empty ? (
        <p className="text-sm text-fg-secondary py-8 text-center">
          {t("noData")}
        </p>
      ) : (
        <div>
          <BarChart daily={daily} mode="stacked" ariaLabel={t("chartMessages")} />
          <div className="flex gap-4 mt-3 text-xs text-fg-secondary">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-accent" />
              {t("sent")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm bg-error" />
              {t("failed")}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

function UsersChart({ daily }: { daily: AdminDaily[] }) {
  const t = useTranslations("admin");
  const empty = daily.every((d) => d.users === 0);
  return (
    <Card className="p-5">
      <h3 className="text-lg mb-1">{t("chartUsers")}</h3>
      <p className="text-xs text-fg-tertiary mb-4">{t("chartHint")}</p>
      {empty ? (
        <p className="text-sm text-fg-secondary py-8 text-center">
          {t("noData")}
        </p>
      ) : (
        <BarChart daily={daily} mode="single" ariaLabel={t("chartUsers")} />
      )}
    </Card>
  );
}

export function AdminActivityCharts({ daily }: { daily: AdminDaily[] }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 stagger-in">
      <MessagesChart daily={daily} />
      <UsersChart daily={daily} />
    </div>
  );
}
