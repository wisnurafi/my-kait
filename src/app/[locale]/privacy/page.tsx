import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal-shell";
import {
  Database,
  ShieldCheck,
  Timer,
  EyeOff,
  Cookie,
  UserCheck,
} from "lucide-react";

const SECTIONS = [
  { icon: Database, t: "s1t", d: "s1d" },
  { icon: ShieldCheck, t: "s2t", d: "s2d" },
  { icon: Timer, t: "s3t", d: "s3d" },
  { icon: EyeOff, t: "s4t", d: "s4d" },
  { icon: Cookie, t: "s5t", d: "s5d" },
  { icon: UserCheck, t: "s6t", d: "s6d" },
] as const;

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  return (
    <LegalShell homeLabel={locale === "en" ? "Home" : "Beranda"}>
      <div className="max-w-2xl space-y-8 animate-fade-in">
        <div>
          <div className="label mb-2">{t("eyebrow")}</div>
          <h2 className="uppercase">{t("title")}</h2>
          <p className="mt-2 font-mono text-xs text-fg-tertiary">
            {t("updated")}
          </p>
        </div>

        {/* TL;DR — ringkasan jujur di atas, biar nggak perlu baca semuanya */}
        <div className="panel p-5 border-accent/30 bg-accent-soft/40">
          <div className="label mb-2 text-accent">TL;DR</div>
          <p className="text-[15px] leading-relaxed text-fg">{t("tldr")}</p>
        </div>

        <div className="space-y-3">
          {SECTIONS.map((s, i) => {
            const Icon = s.icon;
            return (
              <section key={s.t} className="panel p-5 md:p-6">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent-soft text-accent">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-fg-tertiary">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-fg leading-tight">{t(s.t)}</h3>
                  </div>
                </div>
                <p className="text-[15px] text-fg-secondary leading-relaxed">
                  {t(s.d)}
                </p>
              </section>
            );
          })}
        </div>
      </div>
    </LegalShell>
  );
}
