import { setRequestLocale, getTranslations } from "next-intl/server";
import { ScheduledList } from "@/components/scheduled/scheduled-list";
import { PageHeader } from "@/components/ui/page-header";
import { Mascot } from "@/components/mascot";

export default async function ScheduledPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("scheduled");
  const tn = await getTranslations("nav");

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow={tn("scheduled")}
        title={t("title")}
        description={t("desc")}
        media={<Mascot mini size={52} />}
      />
      <ScheduledList />
    </div>
  );
}
