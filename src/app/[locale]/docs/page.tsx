import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal-shell";

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="panel overflow-hidden">
      {label && (
        <div className="px-4 py-2 border-b border-border-ink font-mono text-xs text-fg-tertiary">
          {label}
        </div>
      )}
      <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="font-display text-lg uppercase mb-3">{title}</h3>
      <div className="space-y-3 text-[15px] text-fg-secondary leading-relaxed">
        {children}
      </div>
    </section>
  );
}

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("docs");

  const paramsList: Array<[string, string]> = [
    [t("pWebhookIdN"), t("pWebhookIdD")],
    [t("pManualUrlN"), t("pManualUrlD")],
    [t("pPayloadN"), t("pPayloadD")],
    [t("pModeN"), t("pModeD")],
    [t("pSavePayloadN"), t("pSavePayloadD")],
    [t("pIdemN"), t("pIdemD")],
  ];
  const errorList = [t("e401"), t("e403"), t("e400"), t("e404"), t("e422"), t("e409"), t("e429"), t("e502")];
  const securityList = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5")];

  return (
    <LegalShell homeLabel={locale === "en" ? "Home" : "Beranda"}>
      <div className="max-w-2xl space-y-10 animate-fade-in">
        <div>
          <div className="label mb-2">{t("eyebrow")}</div>
          <h2 className="uppercase">{t("title")}</h2>
          <p className="mt-3 text-[15px] text-fg-secondary leading-relaxed">
            {t("intro")}
          </p>
        </div>

        <Section title={t("authTitle")}>
          <p>{t("authBody")}</p>
          <CodeBlock code={"Authorization: Bearer mk_live_..."} />
          <p>{t("authNote")}</p>
        </Section>

        <Section title={t("endpointTitle")}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-accent-soft text-accent border border-accent/30">
              POST
            </span>
            <code className="font-mono text-sm">/api/v1/send</code>
          </div>
          <p className="text-sm">{t("endpointMeta")}</p>

          <h4 className="font-bold text-fg pt-2">{t("paramsTitle")}</h4>
          <ul className="space-y-2">
            {paramsList.map(([name, desc]) => (
              <li key={name} className="panel p-3">
                <code className="font-mono text-sm text-accent">{name}</code>
                <p className="text-sm mt-1">{desc}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("exampleTitle")}>
          <CodeBlock code={t("exampleCurl")} label="curl" />
        </Section>

        <Section title={t("responseTitle")}>
          <CodeBlock code={t("responseOk")} label={t("responseOkLabel")} />
          <CodeBlock code={t("responseErr")} label={t("responseErrLabel")} />
        </Section>

        <Section title={t("errorsTitle")}>
          <ul className="space-y-2">
            {errorList.map((e) => (
              <li key={e} className="panel p-3 font-mono text-[13px]">
                {e}
              </li>
            ))}
          </ul>
        </Section>

        <Section title={t("rateTitle")}>
          <p>{t("rateBody")}</p>
        </Section>

        <Section title={t("securityTitle")}>
          <ul className="list-disc pl-5 space-y-1.5">
            {securityList.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Section>
      </div>
    </LegalShell>
  );
}
