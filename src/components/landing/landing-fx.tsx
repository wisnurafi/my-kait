"use client";

import { useEffect } from "react";

/**
 * Efek global landing: status scrolled di nav, reveal-on-scroll yang
 * me-reset saat keluar viewport (replay tanpa refresh), dan tilt 3D
 * antar-section berbasis posisi viewport.
 */
export function LandingFx() {
  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const nav = document.getElementById("ld-nav");

    const onScrollNav = () => {
      nav?.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScrollNav();
    window.addEventListener("scroll", onScrollNav, { passive: true });

    const revealEls = Array.from(
      document.querySelectorAll(".ld-root .ld-reveal, .ld-root .ld-pop"),
    );
    let io: IntersectionObserver | null = null;
    if (reduced) {
      revealEls.forEach((el) => el.classList.add("ld-in"));
    } else {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              e.target.classList.add("ld-in");
            } else {
              // reset hanya kalau sudah sepenuhnya keluar viewport —
              // anti flicker saat elemen pas di tepi threshold
              const r = (e.target as HTMLElement).getBoundingClientRect();
              if (r.bottom < 0 || r.top > window.innerHeight) {
                e.target.classList.remove("ld-in");
              }
            }
          }
        },
        { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
      );
      revealEls.forEach((el) => io!.observe(el));
    }

    const tiltEls = Array.from(
      document.querySelectorAll<HTMLElement>(".ld-root .ld-tilt3d"),
    );
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of tiltEls) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const c = r.top + r.height / 2 - vh / 2;
        const deg = Math.max(-14, Math.min(14, (c / vh) * 22));
        el.style.transform = `perspective(1300px) rotateX(${(-deg).toFixed(2)}deg)`;
      }
    };
    const onScrollTilt = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    if (!reduced && tiltEls.length > 0) {
      update();
      window.addEventListener("scroll", onScrollTilt, { passive: true });
      window.addEventListener("resize", onScrollTilt);
    }

    return () => {
      window.removeEventListener("scroll", onScrollNav);
      window.removeEventListener("scroll", onScrollTilt);
      window.removeEventListener("resize", onScrollTilt);
      io?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return null;
}
