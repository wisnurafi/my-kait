import { setRequestLocale, getTranslations } from "next-intl/server";
import { ApiKeysCard } from "@/components/api-keys/api-keys-card";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="label mb-2">{t("apiKeysTitle")}</div>
        <h2 className="uppercase">{t("apiKeysTitle")}</h2>
        <p className="text-sm text-fg-secondary mt-2">{t("apiKeysDesc")}</p>
      </div>
      <ApiKeysCard />
    </div>
  );
}
