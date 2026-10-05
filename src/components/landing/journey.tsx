"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Eye, Send, CheckCheck } from "lucide-react";

const steps = [
  { key: "j1", icon: Pencil },
  { key: "j2", icon: Eye },
  { key: "j3", icon: Send },
  { key: "j4", icon: CheckCheck },
] as const;

/* ------------------------------------------------------------------ */
/* Data stream — partikel ngalir searah pipeline                        */
/* ------------------------------------------------------------------ */
function DataStream() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const stage = cv.closest(".ld-jstage");
    if (!stage) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    interface P {
      x: number;
      y: number;
      v: number;
      r: number;
      ph: number;
      sp: number;
      a: number;
      lime: boolean;
    }
    let W = 0;
    let H = 0;
    let axisY = 0;
    let parts: P[] = [];

    const spawn = (x?: number): P => {
      const spread = (Math.random() + Math.random() + Math.random()) / 3;
      return {
        x: x !== undefined ? x : -12 - Math.random() * 40,
        y: axisY + (spread * 2 - 1) * 78,
        v: 0.5 + Math.random() * 1.1,
        r: 0.8 + Math.random() * 1.8,
        ph: Math.random() * Math.PI * 2,
        sp: 0.5 + Math.random() * 1.5,
        a: 0.14 + Math.random() * 0.4,
        lime: Math.random() < 0.35,
      };
    };

    const resize = () => {
      const r = stage.getBoundingClientRect();
      W = r.width;
      H = r.height;
      cv.width = W * DPR;
      cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const line = stage.querySelector(".ld-jline");
      if (line) {
        const lr = line.getBoundingClientRect();
        axisY = lr.top + lr.height / 2 - r.top;
      }
      const n = Math.min(80, Math.floor(W / 14));
      parts = Array.from({ length: n }, () => {
        const p = spawn();
        p.x = Math.random() * (W + 24) - 12;
        return p;
      });
    };

    const draw = (t: number, animate: boolean) => {
      const light = document.documentElement.dataset.theme === "light";
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        if (animate) {
          p.x += p.v;
          if (p.x > W + 12) Object.assign(p, spawn());
        }
        const edge = Math.min(1, (p.x + 12) / 70, (W + 12 - p.x) / 70);
        const wob = animate ? Math.sin(t * 0.001 * p.sp + p.ph) * 8 : 0;
        ctx.globalAlpha = Math.max(0, p.a * edge * (light ? 0.7 : 1));
        ctx.fillStyle = p.lime ? "#a3e635" : light ? "#71717a" : "#9a9aa5";
        ctx.beginPath();
        ctx.arc(p.x, p.y + wob, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    let raf = 0;
    const frame = (t: number) => {
      draw(t, true);
      raf = requestAnimationFrame(frame);
    };

    window.addEventListener("resize", resize);
    resize();
    if (reduced) {
      draw(0, false);
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} id="ld-datastream" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Journey — pipeline 4 langkah                                         */
/* ------------------------------------------------------------------ */
export function Journey() {
  const t = useTranslations("landing");
  const [lit, setLit] = useState(-1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % steps.length;
      setLit(i);
    }, 1125);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="ld-journey ld-tilt3d">
      <div className="ld-wrap">
        <div className="ld-sec-head ld-reveal">
          <span className="ld-label">{t("journeyEyebrow")}</span>
          <h2>{t("journeyTitle")}</h2>
          <p>{t("journeyDesc")}</p>
        </div>
        <div className="ld-jstage ld-reveal">
          <DataStream />
          <div className="ld-jtrack">
            <div className="ld-jline" aria-hidden="true">
              <span className="ld-traveler" />
            </div>
            {steps.map((s, idx) => (
              <div
                key={s.key}
                className={`ld-jnode ld-pop${idx === lit ? " lit" : ""}`}
                data-d={String(idx + 1)}
              >
                <span className="ld-n">
                  <s.icon />
                </span>
                <b>{t(`journey.${s.key}.t`)}</b>
                <span>{t(`journey.${s.key}.d`)}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="ld-jcap ld-reveal" data-d="1">
          {t.rich("journeyCap", { b: (chunks) => <b>{chunks}</b> })}
        </p>
      </div>
    </section>
  );
}
