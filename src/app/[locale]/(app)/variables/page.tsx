import { setRequestLocale, getTranslations } from "next-intl/server";
import { VariablesManager } from "@/components/variables/variables-manager";
import { PageHeader } from "@/components/ui/page-header";
import { Mascot } from "@/components/mascot";

export default async function VariablesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("variables");
  const tn = await getTranslations("nav");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow={tn("variables")}
        title={t("variablesTitle")}
        media={<Mascot mini size={52} />}
      />
      <VariablesManager />
    </div>
  );
}
