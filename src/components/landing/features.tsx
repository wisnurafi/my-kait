"use client";

import { useTranslations } from "next-intl";
import { PenLine, Radio, Blocks, Activity } from "lucide-react";

/**
 * Features — bento grid asimetris + spotlight yang ngikutin mouse.
 */
export function Features() {
  const t = useTranslations("landing");

  const onMove = (e: React.MouseEvent) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".ld-bcard");
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty("--mx", `${e.clientX - r.left}px`);
    card.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  return (
    <section className="ld-features ld-tilt3d" id="fitur">
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
