import { setRequestLocale, getTranslations } from "next-intl/server";
import { ScheduledList } from "@/components/scheduled/scheduled-list";

export default async function ScheduledPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("scheduled");

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <div className="label mb-2">{t("title")}</div>
        <h2 className="uppercase">{t("title")}</h2>
        <p className="text-sm text-fg-secondary mt-2">{t("desc")}</p>
      </div>
      <ScheduledList />
    </div>
  );
}
