import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal-shell";

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("privacy");

  const sections: Array<[string, string]> = [
    [t("s1t"), t("s1d")],
    [t("s2t"), t("s2d")],
    [t("s3t"), t("s3d")],
    [t("s4t"), t("s4d")],
    [t("s5t"), t("s5d")],
    [t("s6t"), t("s6d")],
  ];

  return (
    <LegalShell homeLabel={locale === "en" ? "Home" : "Beranda"}>
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div>
        <div className="label mb-2">{t("eyebrow")}</div>
        <h2 className="uppercase">{t("title")}</h2>
      </div>
      <div className="panel p-6 md:p-8 space-y-6 text-[15px] text-fg-secondary leading-relaxed">
        {sections.map(([title, desc]) => (
          <section key={title}>
            <h3 className="text-fg mb-1.5">{title}</h3>
            <p>{desc}</p>
          </section>
        ))}
      </div>
    </div>
    </LegalShell>
  );
}
