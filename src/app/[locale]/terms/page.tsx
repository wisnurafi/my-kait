import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal-shell";

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("terms");

  const prohibitions = [t("forbid1"), t("forbid2"), t("forbid3"), t("forbid4")];

  return (
    <LegalShell homeLabel={locale === "en" ? "Home" : "Beranda"}>
    <div className="max-w-2xl space-y-8 animate-fade-in">
      <div>
        <div className="label mb-2">{t("eyebrow")}</div>
        <h2 className="uppercase">{t("title")}</h2>
      </div>
      <div className="panel p-6 md:p-8 space-y-6 text-[15px] text-fg-secondary leading-relaxed">
        <section>
          <h3 className="text-fg mb-1.5">{t("useT")}</h3>
          <p>{t("useD")}</p>
        </section>
        <section>
          <h3 className="text-fg mb-1.5">{t("forbidT")}</h3>
          <ul className="list-disc list-inside space-y-1.5">
            {prohibitions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-fg mb-1.5">{t("respT")}</h3>
          <p>{t("respD")}</p>
        </section>
        <section>
          <h3 className="text-fg mb-1.5">{t("changeT")}</h3>
          <p>{t("changeD")}</p>
        </section>
      </div>
    </div>
    </LegalShell>
  );
}
