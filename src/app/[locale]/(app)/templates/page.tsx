import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { getTemplates, getAllTemplateTags } from "@/server/actions/templates";
import { getFolders } from "@/server/actions/folders";
import { TemplatesList } from "@/components/templates/templates-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ search?: string; tag?: string; folder?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { search, tag, folder, page } = await searchParams;
  const [data, folders, allTags] = await Promise.all([
    getTemplates({
      search,
      tagFilter: tag,
      folderId: folder,
      page: page ? parseInt(page) : 1,
    }),
    getFolders(),
    getAllTemplateTags(),
  ]);
  const t = await getTranslations("templates");

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} />
      <TemplatesList
        templates={data.templates}
        folders={folders}
        activeFolder={folder ?? "all"}
        allTags={allTags}
        pagination={{ page: data.page, totalPages: data.totalPages }}
      />
    </div>
  );
}
