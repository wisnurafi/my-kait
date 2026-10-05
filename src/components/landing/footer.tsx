"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { HookLogo } from "@/components/hook-logo";

/**
 * Footer — satu baris, simple & elegan.
 */
export function Footer() {
  const t = useTranslations("landing");

  return (
    <footer className="ld-footer">
      <div className="ld-wrap">
        <div className="ld-foot">
          <Link href="/" className="ld-brand" aria-label="My-Kait">
            <HookLogo size={26} />
            My-Kait
          </Link>
          <nav className="ld-foot-links" aria-label="Footer">
            <a href="#fitur">{t("navFeatures")}</a>
            <a href="#cara">{t("navHow")}</a>
            <Link href="/gallery">{t("navGallery")}</Link>
            <a
              href="https://github.com/wisnurafi/my-kait"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <Link href="/privacy">{t("navPrivacy")}</Link>
          </nav>
          <small>© 2026 my-kait · mit</small>
        </div>
      </div>
    </footer>
  );
}
