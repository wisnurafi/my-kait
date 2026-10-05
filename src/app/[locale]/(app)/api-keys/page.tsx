import { setRequestLocale, getTranslations } from "next-intl/server";
import { ApiKeysCard } from "@/components/api-keys/api-keys-card";
import { PageHeader } from "@/components/ui/page-header";
import { Mascot } from "@/components/mascot";

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("settings");
  const tn = await getTranslations("nav");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow={tn("apiKeys")}
        title={t("apiKeysTitle")}
        description={t("apiKeysDesc")}
        media={<Mascot mini size={52} />}
      />
      <ApiKeysCard />
    </div>
  );
}
