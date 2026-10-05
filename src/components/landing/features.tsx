"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PenLine, Radio, Blocks, Activity } from "lucide-react";

/**
 * Features — bento grid asimetris + spotlight yang ngikutin mouse.
 */
export function Features() {
  const t = useTranslations("landing");
  const secRef = useRef<HTMLElement | null>(null);

  /* orbs cahaya ngikutin mouse */
  useEffect(() => {
    const sec = secRef.current;
    if (
      !sec ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const o1 = sec.querySelector<HTMLElement>(".ld-orb.ld-o1");
    const o2 = sec.querySelector<HTMLElement>(".ld-orb.ld-o2");
    if (!o1 || !o2) return;
    let tx = 0,
      ty = 0,
      x1 = 0,
      y1 = 0,
      x2 = 0,
      y2 = 0,
      raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = sec.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
    };
    const loop = () => {
      x1 += (tx * 70 - x1) * 0.05;
      y1 += (ty * 70 - y1) * 0.05;
      x2 += (tx * -100 - x2) * 0.04;
      y2 += (ty * -100 - y2) * 0.04;
      o1.style.transform = `translate(${x1.toFixed(1)}px,${y1.toFixed(1)}px)`;
      o2.style.transform = `translate(${x2.toFixed(1)}px,${y2.toFixed(1)}px)`;
      raf = requestAnimationFrame(loop);
    };
    sec.addEventListener("pointermove", onMove, { passive: true });
    sec.addEventListener("pointerleave", onLeave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      sec.removeEventListener("pointermove", onMove);
      sec.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".ld-bcard");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <section ref={secRef} className="ld-features ld-tilt3d" id="fitur">
      <div className="ld-floor" aria-hidden="true" />
      <div className="ld-orb ld-o1" aria-hidden="true" />
      <div className="ld-orb ld-o2" aria-hidden="true" />
      <div className="ld-wrap">
        <div className="ld-sec-head ld-reveal">
          <span className="ld-label">{t("featuresEyebrow")}</span>
          <h2>{t("featuresTitle")}</h2>
          <p>{t("featuresDesc")}</p>
        </div>

        <div className="ld-bento ld-reveal" onMouseMove={onMove}>
          {/* editor + preview */}
          <div className="ld-bcard ld-wide ld-pop" data-d="1">
            <span className="ld-bicon"><PenLine /></span>
            <h3>{t("featEditorT")}</h3>
            <p>{t("featEditorD")}</p>
            <div className="ld-bvisual" aria-hidden="true">
              <div className="ld-mini-msg">
                <span className="ld-avatar">W</span>
                <div>
                  <div className="ld-who">wisnu <time>21.14</time></div>
                  <div className="ld-txt">{t("featChat1")}</div>
                </div>
              </div>
              <div className="ld-mini-msg">
                <span className="ld-avatar">K</span>
                <div>
                  <div className="ld-who">kait <time>21.14</time></div>
                  <div className="ld-txt">{t("featChat2")}</div>
                </div>
              </div>
              <div className="ld-mini-msg">
                <span className="ld-avatar">W</span>
                <div>
                  <div className="ld-who">wisnu <time>21.15</time></div>
                  <div className="ld-txt">{t("featChat3")}</div>
                </div>
              </div>
            </div>
          </div>

          {/* broadcast */}
          <div className="ld-bcard ld-narrow ld-pop" data-d="2">
            <span className="ld-bicon"><Radio /></span>
            <h3>{t("featMultiT")}</h3>
            <p>{t("featMultiD")}</p>
            <div className="ld-bvisual" aria-hidden="true">
              <div className="ld-target"># {t("demoChan1")}<span className="ld-st">{t("featSent")}</span></div>
              <div className="ld-target"># {t("demoChan2")}<span className="ld-st">{t("featSending")}</span></div>
              <div className="ld-target"># {t("demoChan3")}<span className="ld-st">{t("featSent")}</span></div>
            </div>
          </div>

          {/* template + variabel */}
          <div className="ld-bcard ld-narrow ld-pop" data-d="3">
            <span className="ld-bicon"><Blocks /></span>
            <h3>{t("featTplT")}</h3>
            <p>{t("featTplD")}</p>
            <div className="ld-bvisual" aria-hidden="true">
              <div className="ld-var-row">
                <span className="ld-var">{"{{nama_event}}"}</span>
                <span className="ld-var">{"{{tanggal}}"}</span>
                <span className="ld-var">{"{{link}}"}</span>
              </div>
            </div>
          </div>

          {/* logs & health */}
          <div className="ld-bcard ld-wide ld-pop" data-d="4">
            <span className="ld-bicon"><Activity /></span>
            <h3>{t("featLogsT")}</h3>
            <p>{t("featLogsD")}</p>
            <div className="ld-bvisual" aria-hidden="true">
              <div className="ld-logbar">
                <span># {t("demoChan1")}</span>
                <span className="ld-track"><span className="ld-fill" style={{ ["--w" as string]: "98%" }} /></span>
                <b>98%</b>
              </div>
              <div className="ld-logbar">
                <span># {t("demoChan2")}</span>
                <span className="ld-track"><span className="ld-fill" style={{ ["--w" as string]: "100%" }} /></span>
                <b>100%</b>
              </div>
              <div className="ld-logbar">
                <span># {t("demoChan3")}</span>
                <span className="ld-track"><span className="ld-fill" style={{ ["--w" as string]: "91%" }} /></span>
                <b>91%</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
