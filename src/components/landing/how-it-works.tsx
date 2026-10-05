"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link2, PenLine, Send } from "lucide-react";

const steps = [
  { key: "s1", icon: Link2 },
  { key: "s2", icon: PenLine },
  { key: "s3", icon: Send },
] as const;

/**
 * HowItWorks — langkah bisa diklik (keyboard-accessible), visual kanan
 * crossfade mengikuti step aktif; scroll juga mengupdate step aktif.
 */
export function HowItWorks() {
  const t = useTranslations("landing");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const els = listRef.current?.querySelectorAll<HTMLElement>(".ld-step");
    if (!els || els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.i);
            if (!Number.isNaN(i)) setActive(i);
          }
        }
      },
      { rootMargin: "-38% 0px -38% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const visuals = [
    /* s1 — tempel webhook */
    <div key="v1">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-border-ink bg-sunken">
          <Link2 size={16} className="text-accent" />
        </span>
        <b className="text-sm">{t("stepVis1T")}</b>
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1 truncate rounded-lg border border-border-ink bg-sunken px-3.5 py-3 font-mono text-xs text-fg-secondary">
          <span className="text-accent-sky">https://</span>
          discord.com/api/webhooks/1293…8842
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2.5 text-[13px] text-success">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="m5 13 4 4L19 7" />
        </svg>
        {t("stepVis1Ok")}
      </div>
    </div>,
    /* s2 — tulis & preview */
    <div key="v2">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-border-ink bg-sunken">
          <PenLine size={16} className="text-accent" />
        </span>
        <b className="text-sm">{t("stepVis2T")}</b>
      </div>
      <div className="overflow-hidden rounded-[10px] border border-border-ink">
        <div className="flex gap-3 bg-[#1e1f22] p-4">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-[#0a0a0b]">
            K
          </span>
          <div className="min-w-0">
            <div className="mb-1 text-[13px] font-bold text-white">
              My-Kait
              <span className="ml-2 rounded bg-[#5865F2] px-1.5 py-0.5 text-[10px] uppercase text-white">APP</span>
            </div>
            <p className="text-[13px] leading-relaxed text-[#dbdee1]">{t("stepVis2Msg")}</p>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[13px] text-fg-secondary">{t("stepVis2D")}</p>
    </div>,
    /* s3 — broadcast */
    <div key="v3">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-border-ink bg-sunken">
          <Send size={16} className="text-accent" />
        </span>
        <b className="text-sm">{t("stepVis3T")}</b>
      </div>
      <div className="font-display text-6xl font-bold tracking-tight text-accent">
        3<small className="ml-1 text-base font-medium text-fg-secondary">/ 3 {t("stepVis3Unit")}</small>
      </div>
      <div className="mt-5 space-y-2">
        {[
          [t("demoChan1"), "200 · 184ms"],
          [t("demoChan2"), "200 · 201ms"],
          [t("demoChan3"), "200 · 176ms"],
        ].map(([ch, meta]) => (
          <div
            key={ch}
            className="flex items-center justify-between rounded-lg border border-border-ink bg-sunken px-3.5 py-2.5 font-mono text-xs"
          >
            <span className="text-fg-secondary"># {ch}</span>
            <span className="text-success">{meta}</span>
          </div>
        ))}
      </div>
    </div>,
  ];

  return (
    <section className="ld-steps ld-tilt3d" id="cara">
      <div className="ld-wrap">
        <div className="ld-sec-head ld-reveal">
          <span className="ld-label">{t("howEyebrow")}</span>
          <h2>{t("howTitle")}</h2>
          <p>{t("howDesc")}</p>
        </div>

        <div className="ld-steps-grid">
          <div ref={listRef}>
            {steps.map((s, i) => (
              <div
                key={s.key}
                data-i={i}
                role="button"
                tabIndex={0}
                aria-pressed={active === i}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActive(i);
                  }
                }}
                className={`ld-step ld-reveal${active === i ? " active" : ""}`}
                data-d={String(Math.min(i + 1, 3))}
              >
                <div className="ld-kicker">
                  {t("stepKicker")} {i + 1}
                </div>
                <h3>{t(`steps.${s.key}.t`)}</h3>
                <p>{t(`steps.${s.key}.d`)}</p>
              </div>
            ))}
          </div>

          <div className="relative hidden lg:block" aria-hidden="true">
            <div className="sticky top-[110px] h-[480px]">
              {visuals.map((v, i) => (
                <div
                  key={i}
                  className={`absolute inset-0 rounded-2xl border border-border-ink bg-surface p-7 transition-all duration-500 ${
                    active === i
                      ? "translate-y-0 scale-100 opacity-100"
                      : "pointer-events-none translate-y-6 scale-[0.985] opacity-0"
                  }`}
                >
                  {v}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
