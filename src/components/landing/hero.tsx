"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { signIn, useSession } from "next-auth/react";
import { Link } from "@/i18n/routing";
import { HookLogo } from "@/components/hook-logo";
import { LandingLocaleToggle } from "@/components/landing/locale-toggle";
import { LandingThemeToggle } from "@/components/landing/theme-toggle";
import type { PublicStats } from "@/lib/public-stats";

/* ------------------------------------------------------------------ */
/* Starfield — bintang twinkle + parallax + meteor + trail lime        */
/* ------------------------------------------------------------------ */
function Starfield() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const hero = cv.parentElement;
    if (!hero) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);

    interface Star {
      x: number;
      y: number;
      r: number;
      ph: number;
      sp: number;
      depth: number;
      lime: boolean;
    }
    interface Meteor {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
    }
    interface Trail {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      r: number;
    }
    let W = 0;
    let H = 0;
    let stars: Star[] = [];
    let meteors: Meteor[] = [];
    let trails: Trail[] = [];
    let mx = 0.5;
    let my = 0.5;
    let px = 0.5;
    let py = 0.5;
    let raf = 0;
    let lastMeteor = 0;

    const resize = () => {
      W = hero.offsetWidth;
      H = hero.offsetHeight;
      cv.width = W * DPR;
      cv.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = Math.min(150, Math.floor((W * H) / 9000));
      stars = Array.from({ length: n }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.4 + 0.4,
        ph: Math.random() * Math.PI * 2,
        sp: 0.4 + Math.random() * 1.2,
        depth: 0.3 + Math.random() * 0.7,
        lime: Math.random() < 0.12,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      mx = (e.clientX - rect.left) / Math.max(1, rect.width);
      my = (e.clientY - rect.top) / Math.max(1, rect.height);
      if (!reduced) {
        for (let i = 0; i < 2; i++) {
          if (trails.length > 90) trails.shift();
          trails.push({
            x: e.clientX - rect.left + (Math.random() - 0.5) * 10,
            y: e.clientY - rect.top + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4 - 0.2,
            life: 1,
            r: Math.random() * 1.8 + 0.6,
          });
        }
      }
    };
    hero.addEventListener("pointermove", onMove);

    const frame = (t: number) => {
      const light =
        document.documentElement.dataset.theme === "light";
      const starRgb = light ? "20,20,28" : "255,255,255";
      ctx.clearRect(0, 0, W, H);

      px += (mx - px) * 0.04;
      py += (my - py) * 0.04;
      const ox = (px - 0.5) * 26;
      const oy = (py - 0.5) * 26;

      for (const s of stars) {
        const tw = reduced ? 0.7 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.001 * s.sp + s.ph));
        const a = (s.lime ? 0.5 : 0.32) * tw * (light ? 0.55 : 1);
        ctx.beginPath();
        ctx.arc(
          s.x * W - ox * s.depth,
          s.y * H - oy * s.depth,
          s.r,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = s.lime
          ? `rgba(163,230,53,${a.toFixed(3)})`
          : `rgba(${starRgb},${a.toFixed(3)})`;
        ctx.fill();
      }

      if (!reduced) {
        if (t - lastMeteor > 5000 + Math.random() * 5000) {
          lastMeteor = t;
          meteors.push({
            x: Math.random() * W * 0.7 + W * 0.2,
            y: -20,
            vx: -(3 + Math.random() * 3),
            vy: 4 + Math.random() * 3,
            life: 1,
          });
        }
        for (let i = meteors.length - 1; i >= 0; i--) {
          const m = meteors[i];
          m.x += m.vx;
          m.y += m.vy;
          m.life -= 0.012;
          if (m.life <= 0 || m.y > H + 40) {
            meteors.splice(i, 1);
            continue;
          }
          const grad = ctx.createLinearGradient(
            m.x, m.y, m.x - m.vx * 12, m.y - m.vy * 12,
          );
          grad.addColorStop(0, `rgba(163,230,53,${(m.life * 0.7).toFixed(3)})`);
          grad.addColorStop(1, "rgba(163,230,53,0)");
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x - m.vx * 12, m.y - m.vy * 12);
          ctx.stroke();
        }

        for (let i = trails.length - 1; i >= 0; i--) {
          const p = trails[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
          if (p.life <= 0) {
            trails.splice(i, 1);
            continue;
          }
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(163,230,53,${(p.life * 0.45).toFixed(3)})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      // satu frame statis
      frame(0);
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      hero.removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="ld-stars" />;
}

/* ------------------------------------------------------------------ */
/* Nav — floating pill                                                 */
/* ------------------------------------------------------------------ */
function LandingNav() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const { status } = useSession();
  const loggedIn = status === "authenticated";
  const login = () => signIn("discord", { callbackUrl: `/${locale}/dashboard` });

  return (
    <header className="ld-nav" id="ld-nav">
      <div className="ld-nav-inner">
        <Link href="/" className="ld-brand" aria-label="My-Kait">
          <HookLogo size={28} />
          My-Kait
          <span className="ld-brand-ver">v1.0</span>
        </Link>
        <nav className="ld-nav-links" aria-label="Navigasi">
          <a href="#fitur">{t("navFeatures")}</a>
          <a href="#cara">{t("navHow")}</a>
          <Link href="/gallery">{t("navGallery")}</Link>
        </nav>
        <div className="ld-nav-right">
          <LandingLocaleToggle />
          <LandingThemeToggle />
          {loggedIn ? (
            <Link href="/dashboard" className="ld-btn ld-btn-sm">
              {t("openDashboard")}
            </Link>
          ) : (
            <button type="button" onClick={login} className="ld-btn ld-btn-sm">
              {t("loginDiscord")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Demo stage — form editor + live preview Discord, animasi loop        */
/* ------------------------------------------------------------------ */
type DemoPhase = "typing" | "sending" | "sent";

interface DemoState {
  msg: string;
  title: string;
  desc: string;
  progress: number; // -1 = idle, 0-99 = uploading, 100 = done
  phase: DemoPhase;
  active: "msg" | "title" | "desc" | null;
  targetsOn: boolean;
}

const DEMO_INIT: DemoState = {
  msg: "",
  title: "",
  desc: "",
  progress: -1,
  phase: "typing",
  active: null,
  targetsOn: false,
};

function DemoStage() {
  const t = useTranslations("landing");
  const [s, setS] = useState<DemoState>(DEMO_INIT);
  const tiltRef = useRef<HTMLDivElement | null>(null);
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const texts = useMemo(
    () => ({
      msg: t("demoMsgText"),
      title: t("demoEmbedTitle"),
      desc: t("demoEmbedDesc"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    const patch = (p: Partial<DemoState>) =>
      setS((prev) => ({ ...prev, ...p }));

    async function typeKey(
      key: "msg" | "title" | "desc",
      text: string,
      speed = 30,
    ) {
      patch({ active: key });
      for (const ch of text) {
        if (cancelled) return;
        setS((prev) => ({ ...prev, [key]: prev[key] + ch }));
        await wait(speed + Math.random() * 34);
      }
      patch({ active: null });
    }

    async function loop() {
      if (reduced) {
        patch({
          ...texts,
          progress: 100,
          phase: "sent",
          targetsOn: true,
          active: null,
        });
        return;
      }
      while (!cancelled) {
        patch({ ...DEMO_INIT });
        await wait(800);
        if (cancelled) return;
        await typeKey("msg", texts.msg);
        if (cancelled) return;
        await wait(350);
        if (cancelled) return;
        await typeKey("title", texts.title, 38);
        if (cancelled) return;
        await typeKey("desc", texts.desc, 26);
        if (cancelled) return;
        await wait(350);
        if (cancelled) return;
        // upload
        patch({ progress: 0 });
        for (let p = 4; p < 100; p += 3 + Math.floor(Math.random() * 7)) {
          if (cancelled) return;
          patch({ progress: p });
          await wait(85);
        }
        patch({ progress: 100, targetsOn: true });
        await wait(600);
        if (cancelled) return;
        patch({ phase: "sending" });
        await wait(1100);
        if (cancelled) return;
        patch({ phase: "sent" });
        await wait(3800);
        if (cancelled) return;
      }
    }

    const anchor = tiltRef.current;
    if (anchor && "IntersectionObserver" in window && !reduced) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            void loop();
            io.disconnect();
          }
        });
      });
      io.observe(anchor);
      return () => {
        cancelled = true;
        io.disconnect();
      };
    }
    void loop();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTiltMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateY(${(px * 7).toFixed(2)}deg) rotateX(${(-py * 7).toFixed(2)}deg)`;
  };
  const onTiltLeave = () => {
    if (tiltRef.current) tiltRef.current.style.transform = "";
  };

  const caret = (k: "msg" | "title" | "desc") =>
    s.active === k ? <span className="ld-caret" /> : null;

  return (
    <div className="ld-stage ld-reveal" data-d="2">
      <div
        ref={tiltRef}
        className="ld-tilt"
        onMouseMove={onTiltMove}
        onMouseLeave={onTiltLeave}
      >
        <div className="ld-scene-glow" aria-hidden="true" />

        {/* ---- form editor ---- */}
        <div className="ld-panel">
          <div className="ld-c-bar">
            <i />
            <i />
            <i />
            <span className="ld-c-title">{t("demoEditorTitle")}</span>
            <span className="ld-draft">
              <span className="ld-dot" />
              {t("demoDraft")}
            </span>
          </div>
          <div className="ld-ed-toolbar" aria-hidden="true">
            <span className="ld-tool-btn">
              <svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></svg>
            </span>
            <span className="ld-tool-btn">
              <svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></svg>
            </span>
            <span className="ld-tool-sep" />
            <span className="ld-tool-btn">JSON</span>
            <span className="ld-tool-btn">TEMPLATE</span>
          </div>
          <div className="ld-ed-body">
            <div className="ld-ed-sec-head">
              <span className="ld-ed-label">{t("demoMsgLabel")}</span>
              <span className="ld-ed-badge">{s.msg.length}/2000</span>
            </div>
            <div className={`ld-ed-field area${s.active === "msg" ? " typing" : ""}`}>
              {s.msg}
              {caret("msg")}
            </div>

            <div className="ld-ed-sec-head">
              <span className="ld-ed-label">{t("demoEmbedLabel")}</span>
              <span className="ld-ed-badge">0/6000</span>
            </div>
            <div className={`ld-ed-embed${s.active === "title" || s.active === "desc" ? " typing" : ""}`}>
              <div className="ld-ed-embed-accent" />
              <div className="ld-ed-embed-main">
                <div className="ld-ed-embed-top">
                  <span className="ld-ed-embed-tag">Embed 1</span>
                  <span className="ld-ed-embed-dot" />
                </div>
                <div className={`ld-ed-embed-input${s.active === "title" ? " active" : ""}`}>
                  {s.title}
                  {caret("title")}
                </div>
                <div className={`ld-ed-embed-input desc${s.active === "desc" ? " active" : ""}`}>
                  {s.desc}
                  {caret("desc")}
                </div>
              </div>
            </div>

            <div className="ld-ed-sec-head">
              <span className="ld-ed-label">{t("demoImgLabel")}</span>
            </div>
            <div className={`ld-ed-upload${s.progress >= 0 && s.progress < 100 ? " active" : ""}`}>
              {s.progress < 0 && (
                <span className="ld-ed-upload-idle">
                  <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                  {t("demoUploadIdle")}
                </span>
              )}
              {s.progress >= 0 && s.progress < 100 && (
                <span className="ld-ed-progress" style={{ display: "block" }}>
                  <span className="ld-track">
                    <span className="ld-bar" style={{ width: `${s.progress}%` }} />
                  </span>
                  <span>{t("demoUploading")} {s.progress}%</span>
                </span>
              )}
              {s.progress >= 100 && (
                <span className="ld-ed-thumb" style={{ display: "flex" }}>
                  <span className="ld-thumb-img">
                    <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 3-3 3 3" /></svg>
                  </span>
                  <span>
                    <b>maintenance-banner.png</b>
                    <span>1.2 MB · 1600×900</span>
                  </span>
                  <span className="ld-ok">✓</span>
                </span>
              )}
            </div>

            <div className="ld-ed-sec-head">
              <span className="ld-ed-label">{t("demoTargetLabel")}</span>
              <span className="ld-ed-badge">{t("demoTargetCount")}</span>
            </div>
            <div className="ld-ed-targets">
              <span className={`ld-ed-chip${s.targetsOn ? " checked" : ""}`}># {t("demoChan1")}</span>
              <span className={`ld-ed-chip${s.targetsOn ? " checked" : ""}`}># {t("demoChan2")}</span>
              <span className="ld-ed-chip"># {t("demoChan3")}</span>
            </div>
          </div>
          <div className="ld-c-foot">
            <span className="ld-ed-hint">
              <kbd>⌘</kbd>
              <kbd>↵</kbd> {t("demoHint")}
            </span>
            <span className={`ld-send-btn${s.phase === "sending" ? " sending" : ""}`}>
              {s.phase === "sending" ? t("demoSending") : t("demoSend")}
            </span>
          </div>
        </div>

        {/* ---- live preview discord ---- */}
        <div className="ld-panel ld-dp">
          <div className="ld-dp-head">
            <span className="ld-dp-dot" />
            <span className="ld-dp-live">{t("demoLivePreview")}</span>
          </div>
          <div className="ld-dp-body">
            {s.msg || s.title ? (
              <div className="ld-dp-msg show">
                <div className="ld-dp-avatar">K</div>
                <div className="ld-dp-main">
                  <div className="ld-dp-namerow">
                    <span className="ld-dp-name">My-Kait</span>
                    <span className="ld-dp-bot">APP</span>
                    <span className="ld-dp-time">{t("demoToday")}</span>
                  </div>
                  <div className="ld-dp-content">{s.msg}</div>
                  {(s.title || s.desc) && (
                    <div className="ld-dp-embed show">
                      <b>{s.title}</b>
                      <p>{s.desc}</p>
                    </div>
                  )}
                  {s.progress >= 100 && (
                    <div className="ld-dp-img show">
                      <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 3-3 3 3" /></svg>
                      <span>maintenance-banner.png</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="ld-dp-empty">
                <svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></svg>
                <span>{t("demoEmptyPreview")}</span>
              </div>
            )}
          </div>
        </div>

        {/* floating chips */}
        {s.phase === "sent" && (
          <>
            <div className="ld-float-a" aria-hidden="true">
              <span className="ld-fchip pop">
                <span className="ld-ok">
                  <svg viewBox="0 0 24 24"><path d="m5 13 4 4L19 7" /></svg>
                </span>
                <span>
                  {t("demoSentMeta")}
                  <small>{t("demoSentSub")}</small>
                </span>
              </span>
            </div>
            <div className="ld-float-b" aria-hidden="true">
              <span className="ld-fchip pop">
                <span className="ld-chan-dot" />
                <span>
                  #{t("demoChan1")}
                  <small>discord.com/api/webhooks/…</small>
                </span>
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini stats — angka real dari public API                             */
/* ------------------------------------------------------------------ */
function MiniStats({ stats }: { stats: PublicStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const compact = (n: number) =>
    new Intl.NumberFormat(locale === "en" ? "en" : "id", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);

  const items = [
    { v: compact(stats.totalMessages), l: t("statsSent") },
    { v: stats.deliveryRate.toFixed(1), unit: "%", l: t("statsRate") },
    { v: compact(stats.totalWebhooks), l: t("statsWebhooks") },
    { v: t("statsFreeVal"), l: t("statsFree") },
  ];

  return (
    <div className="ld-ministats ld-reveal" data-d="3">
      {items.map((it) => (
        <div className="ld-mstat" key={it.l}>
          <div className="v">
            {it.v}
            {it.unit && <span className="unit"> {it.unit}</span>}
          </div>
          <div className="l">{it.l}</div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scroll hint                                                         */
/* ------------------------------------------------------------------ */
function ScrollHint() {
  const t = useTranslations("landing");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      el.classList.toggle("hide", window.scrollY > 60);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={ref} className="ld-scrollhint" aria-hidden="true">
      <div className="mouse">
        <div className="wheel" />
      </div>
      <span>{t("scrollHint")}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Landing hero                                                        */
/* ------------------------------------------------------------------ */
export function LandingHero({ stats }: { stats: PublicStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const { status } = useSession();
  const loggedIn = status === "authenticated";
  const login = () =>
    signIn("discord", { callbackUrl: `/${locale}/dashboard` });

  return (
    <>
      <LandingNav />
      <section className="ld-hero">
        <div className="ld-hero-glow" aria-hidden="true" />
        <Starfield />
        <div className="ld-wrap">
          <div className="ld-hero-copy">
            <span className="ld-hero-badge ld-reveal ld-in">
              <span className="dot" />
              {t("heroBadgeVer")} · <b>{t("heroBadgeNote")}</b>
            </span>
            <h1 className="ld-reveal ld-in" data-d="1">
              {t.rich("heroTitle", {
                lime: (chunks) => <span className="lime">{chunks}</span>,
              })}
            </h1>
            <p className="sub ld-reveal ld-in" data-d="2">
              {t("heroSubtitle")}
            </p>
            <div className="ld-hero-cta ld-reveal ld-in" data-d="3">
              {loggedIn ? (
                <Link href="/dashboard" className="ld-btn">
                  {t("openDashboard")}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </Link>
              ) : (
                <button type="button" onClick={login} className="ld-btn">
                  {t("ctaStart")}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}
              <Link href="/gallery" className="ld-btn ld-btn-ghost">
                {t("ctaGallery")}
              </Link>
            </div>
            <MiniStats stats={stats} />
          </div>
          <DemoStage />
        </div>
        <ScrollHint />
      </section>
    </>
  );
}
