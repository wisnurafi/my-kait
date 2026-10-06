import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSharedTemplateBySlug } from "@/server/actions/templates";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiscordPreview } from "@/components/editor/discord-preview";
import { ReportButton } from "@/components/templates/report-button";
import { ImportTemplateButton } from "@/components/templates/import-template-button";
import { Link } from "@/i18n/routing";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { PublicThemeManager } from "@/components/landing/theme-toggle";
import { auth } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";

// Dedup fetch antara generateMetadata dan page (1 request = 1 hit rate limit).
const getCachedShared = cache(getSharedTemplateBySlug);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const shared = await getCachedShared(slug);
  if (!shared) return {};
  const title = `${shared.name} | My Kait`;
  const description = shared.description ?? undefined;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function SharedTemplatePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("templates");

  const shared = await getCachedShared(slug);
  if (!shared) notFound();

  const session = await auth();
  const sharedDate = new Date(shared.sharedAt).toLocaleDateString(
    locale === "id" ? "id-ID" : "en-US",
    { day: "numeric", month: "short", year: "numeric" },
  );

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <PublicThemeManager />
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back to gallery */}
        <Link
          href="/gallery"
          className="inline-flex items-center gap-1.5 text-sm text-fg-secondary hover:text-fg transition-colors"
        >
          <ArrowLeft size={14} />
          {t("backToGallery")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl uppercase">
              <span className="gradient-text">{shared.name}</span>
            </h1>
            {shared.description && (
              <p className="text-fg-secondary mt-1">{shared.description}</p>
            )}
            <p className="mt-2 font-mono text-xs text-fg-tertiary flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>@{shared.author}</span>
              <span aria-hidden>·</span>
              <span>{sharedDate}</span>
              <span aria-hidden>·</span>
              <span>{t("importCount", { count: shared.importCount })}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className={buttonClasses("ghost", "sm")}>
              My Kait
            </Link>
          </div>
        </div>

        {/* Tags -> filter galeri */}
        {shared.tags && shared.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {shared.tags.map((tag: string) => (
              <Link
                key={tag}
                href={`/gallery?tag=${encodeURIComponent(tag)}`}
                className="no-underline"
              >
                <Badge
                  variant="default"
                  className="cursor-pointer transition-colors hover:border-accent/40 hover:text-accent"
                >
                  #{tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Preview */}
        <Card className="p-5">
          <h2 className="font-display uppercase text-sm mb-3">{t("previewTitle")}</h2>
          <DiscordPreview payload={shared.payload as Record<string, unknown>} username="My Kait" />
        </Card>

        {/* Import */}
        <Card className="p-5">
          {session?.user ? (
            <div>
              <p className="text-sm text-fg-secondary mb-3">
                {t("importHint")}
              </p>
              <ImportTemplateButton shareId={shared.shareId} />
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-fg-secondary mb-4">
                {t("loginToImport")}
              </p>
              <DiscordLoginButton callbackUrl={`/t/${slug}`}>
                {t("loginWithDiscord")}
              </DiscordLoginButton>
            </div>
          )}
        </Card>

        {/* Report */}
        <div className="flex justify-center">
          <ReportButton templateId={shared.id} />
        </div>
      </div>
    </div>
  );
}
