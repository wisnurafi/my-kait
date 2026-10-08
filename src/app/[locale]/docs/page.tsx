import { setRequestLocale, getTranslations } from "next-intl/server";
import { LegalShell } from "@/components/legal-shell";
import { CopyButton } from "@/components/docs/copy-button";
import { cn } from "@/lib/utils";

function CodeBlock({
  code,
  label,
  copyLabel,
  copiedLabel,
}: {
  code: string;
  label?: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-2 border-b border-border-ink flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-fg-tertiary truncate">
          {label ?? ""}
        </span>
        <CopyButton code={code} copyLabel={copyLabel} copiedLabel={copiedLabel} />
      </div>
      <pre className="p-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-fg">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h3 className="font-display text-lg uppercase mb-3">{title}</h3>
      <div className="space-y-3 text-[15px] text-fg-secondary leading-relaxed">
        {children}
      </div>
    </section>
  );
}

const REQ_BADGE: Record<"required" | "oneOf" | "optional", string> = {
  required: "border-error/30 bg-error/10 text-error",
  oneOf: "border-accent/30 bg-accent-soft text-accent",
  optional: "border-border-ink bg-surface text-fg-tertiary",
};

export default async function DocsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("docs");

  const toc: Array<[string, string]> = [
    ["auth", t("authTitle")],
    ["endpoint", t("endpointTitle")],
    ["example", t("exampleTitle")],
    ["response", t("responseTitle")],
    ["errors", t("errorsTitle")],
    ["rate", t("rateTitle")],
    ["security", t("securityTitle")],
  ];

  const paramsRows: Array<{
    name: string;
    desc: string;
    req: "required" | "oneOf" | "optional";
  }> = [
    { name: t("pWebhookIdN"), desc: t("pWebhookIdD"), req: "oneOf" },
    { name: t("pManualUrlN"), desc: t("pManualUrlD"), req: "oneOf" },
    { name: t("pPayloadN"), desc: t("pPayloadD"), req: "required" },
    { name: t("pModeN"), desc: t("pModeD"), req: "optional" },
    { name: t("pSavePayloadN"), desc: t("pSavePayloadD"), req: "optional" },
    { name: t("pIdemN"), desc: t("pIdemD"), req: "optional" },
  ];

  // "401 · missing_api_key, ... — ..." -> { code, codes, desc }
  const errorRows = [
    t("e401"),
    t("e403"),
    t("e400"),
    t("e404"),
    t("e422"),
    t("e409"),
    t("e429"),
    t("e502"),
  ].map((e) => {
    const [code, rest] = e.split("·").map((s) => s.trim());
    const [codes, desc] = (rest ?? "").split("—").map((s) => s.trim());
    return { code, codes, desc };
  });

  const securityList = [t("s1"), t("s2"), t("s3"), t("s4"), t("s5")];
  const copyLabel = t("copy");
  const copiedLabel = t("copied");

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

        {/* TOC: sticky chip bar */}
        <div className="sticky top-3 z-10">
          <nav
            aria-label={t("tocLabel")}
            className="panel px-3 py-2 flex gap-1.5 overflow-x-auto"
          >
            {toc.map(([id, title]) => (
              <a
                key={id}
                href={`#${id}`}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium text-fg-secondary transition-colors hover:text-fg hover:bg-accent-soft"
              >
                {title}
              </a>
            ))}
          </nav>
        </div>

        <Section id="auth" title={t("authTitle")}>
          <p>{t("authBody")}</p>
          <CodeBlock
            code={"Authorization: Bearer mk_live_..."}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
          <p>{t("authNote")}</p>
        </Section>

        <Section id="endpoint" title={t("endpointTitle")}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-accent-soft text-accent border border-accent/30">
              POST
            </span>
            <code className="font-mono text-sm">/api/v1/send</code>
          </div>
          <p className="text-sm">{t("endpointMeta")}</p>

          <h4 className="font-bold text-fg pt-2">{t("paramsTitle")}</h4>
          <div className="panel overflow-hidden">
            <table className="rtable">
              <thead>
                <tr>
                  <th scope="col">{t("thParam")}</th>
                  <th scope="col">{t("thReq")}</th>
                  <th scope="col">{t("thDesc")}</th>
                </tr>
              </thead>
              <tbody>
                {paramsRows.map((r) => (
                  <tr key={r.name}>
                    <td data-label={t("thParam")}>
                      <code className="font-mono text-sm text-accent">
                        {r.name}
                      </code>
                    </td>
                    <td data-label={t("thReq")}>
                      <span
                        className={cn(
                          "inline-block whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[11px]",
                          REQ_BADGE[r.req],
                        )}
                      >
                        {t(r.req)}
                      </span>
                    </td>
                    <td data-label={t("thDesc")} className="text-sm">
                      {r.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="example" title={t("exampleTitle")}>
          <CodeBlock
            code={t("exampleCurl")}
            label="curl"
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
        </Section>

        <Section id="response" title={t("responseTitle")}>
          <CodeBlock
            code={t("responseOk")}
            label={t("responseOkLabel")}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
          <CodeBlock
            code={t("responseErr")}
            label={t("responseErrLabel")}
            copyLabel={copyLabel}
            copiedLabel={copiedLabel}
          />
          <p className="text-sm text-fg-secondary mt-3">{t("responseNote")}</p>
        </Section>

        <Section id="errors" title={t("errorsTitle")}>
          <div className="panel overflow-hidden">
            <table className="rtable">
              <thead>
                <tr>
                  <th scope="col">{t("thCode")}</th>
                  <th scope="col">{t("thError")}</th>
                  <th scope="col">{t("thMeaning")}</th>
                </tr>
              </thead>
              <tbody>
                {errorRows.map((r) => (
                  <tr key={r.code}>
                    <td data-label={t("thCode")}>
                      <code className="font-mono text-sm font-bold text-error">
                        {r.code}
                      </code>
                    </td>
                    <td data-label={t("thError")}>
                      <code className="font-mono text-[13px] text-fg">
                        {r.codes}
                      </code>
                    </td>
                    <td data-label={t("thMeaning")} className="text-sm">
                      {r.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="rate" title={t("rateTitle")}>
          <p>{t("rateBody")}</p>
        </Section>

        <Section id="security" title={t("securityTitle")}>
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
