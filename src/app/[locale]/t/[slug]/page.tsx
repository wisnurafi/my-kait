import { setRequestLocale, getTranslations } from "next-intl/server";
import { getSharedTemplateBySlug } from "@/server/actions/templates";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DiscordPreview } from "@/components/editor/discord-preview";
import { ReportButton } from "@/components/templates/report-button";
import { ImportTemplateButton } from "@/components/templates/import-template-button";
import Link from "next/link";
import { DiscordLoginButton } from "@/components/auth/discord-login-button";
import { LandingLocaleToggle } from "@/components/landing/locale-toggle";
import {
  LandingThemeToggle,
  PublicThemeManager,
} from "@/components/landing/theme-toggle";
import { auth } from "@/lib/auth";

export default async function SharedTemplatePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("templates");

  const shared = await getSharedTemplateBySlug(slug);
  if (!shared) notFound();

  const session = await auth();

  return (
    <div className="min-h-screen p-6 animate-fade-in">
      <PublicThemeManager />
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-display text-3xl uppercase">
              <span className="gradient-text">{shared.name}</span>
            </h1>
            {shared.description && (
              <p className="text-fg-secondary mt-1">{shared.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <LandingLocaleToggle />
            <LandingThemeToggle />
            <Link href="/" className={buttonClasses("ghost", "sm")}>
              My Kait
            </Link>
          </div>
        </div>

        {/* Tags */}
        {shared.tags && shared.tags.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {shared.tags.map((tag: string) => (
              <Badge key={tag} variant="default">{tag}</Badge>
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

        {/* Import count + Report */}
        <div className="flex flex-col items-center justify-center gap-3 text-xs text-fg-tertiary">
          <div className="flex items-center gap-4">
            <span>{t("importCount", { count: shared.importCount })}</span>
            <span>·</span>
            <ReportButton templateId={shared.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
