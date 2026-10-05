"use client";

import { useTranslations, useLocale } from "next-intl";
import { signIn } from "next-auth/react";
import { ShieldOff, Infinity as InfinityIcon, Gift } from "lucide-react";

/**
 * Free banner — full-bleed lime band, dark ink text.
 * The one place the accent color goes loud.
 */
export function FreeBanner() {
  const t = useTranslations("landing");
  const locale = useLocale();

  const points = [
    { icon: ShieldOff, label: t("freeNoPaywall") },
    { icon: InfinityIcon, label: t("freeNoQuota") },
    { icon: Gift, label: t("freeNoCard") },
  ] as const;

  return (
    <section className="border-t border-border-ink bg-accent text-[#0a0a0b]">
      <div className="mx-auto max-w-4xl px-6 py-16 text-center sm:py-24">
        <div className="label mb-4" style={{ color: "rgba(10,10,11,0.6)" }}>
          pricing plan
        </div>
        <h2 className="font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl md:text-6xl">
          {t("freeTitle")}
          <br />
          {t("freeTitle2")}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#0a0a0b]/80">
          {t("freeDesc")}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {points.map((p) => (
            <div
              key={p.label}
              className="flex items-center gap-2 rounded-lg border border-[#0a0a0b]/40 px-4 py-2"
            >
              <p.icon size={17} strokeWidth={2.25} />
              <span className="font-mono text-xs font-bold uppercase tracking-[0.08em]">
                {p.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <button
            type="button"
            onClick={() =>
              signIn("discord", { callbackUrl: `/${locale}/dashboard` })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-[#0a0a0b] bg-[#0a0a0b] px-6 py-3 font-mono text-sm font-semibold text-accent transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("freeCta")} →
          </button>
        </div>
      </div>
    </section>
  );
}
