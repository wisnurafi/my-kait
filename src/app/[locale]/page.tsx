import { setRequestLocale } from "next-intl/server";
import { getPublicStats } from "@/lib/public-stats";
import { LandingHero } from "@/components/landing/hero";
import { Journey } from "@/components/landing/journey";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FreeBanner } from "@/components/landing/free-banner";
import { Footer } from "@/components/landing/footer";
import { LandingFx } from "@/components/landing/landing-fx";

// ISR 5 menit — samakan dengan cache /api/stats
export const revalidate = 300;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const stats = await getPublicStats();

  return (
    <main className="ld-root relative">
      <LandingFx />
      <LandingHero stats={stats} />
      <Journey />
      <Features />
      <HowItWorks />
      <FreeBanner />
      <Footer />
    </main>
  );
}
