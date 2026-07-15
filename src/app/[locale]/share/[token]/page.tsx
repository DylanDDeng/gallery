import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { getSharedGeneration } from "@/lib/generation-share";
import { getModelPricing } from "@/lib/model-pricing";

export const dynamic = "force-dynamic";

type SharePageProps = {
  params: Promise<{ locale: Locale; token: string }>;
};

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { locale, token } = await params;
  const generation = await getSharedGeneration(token);

  if (!generation) {
    return {};
  }

  const t = await getTranslations({ locale, namespace: "share" });
  const title = t("metadataTitle");
  const description = t("metadataDescription", {
    model: getModelPricing(generation.model).name,
  });

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title,
      description,
      images: [{ url: generation.result_url, alt: t("imageAlt") }],
      locale: locale === "zh" ? "zh_CN" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [generation.result_url],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { locale, token } = await params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  const generation = await getSharedGeneration(token);
  if (!generation) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: "share" });
  const modelName = getModelPricing(generation.model).name;

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#2a2520] dark:bg-[#0c0b09] dark:text-[#c4bdb4]">
      <header className="border-b border-[#d5cfc4] dark:border-[#2a2520]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-5 py-4 sm:px-8">
          <Link
            href="/"
            className="text-[12px] font-medium uppercase tracking-[0.32em] transition-opacity hover:opacity-60"
          >
            Aestara
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto grid max-w-[1320px] gap-10 px-5 py-9 sm:px-8 sm:py-14 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-16 lg:py-20">
        <section className="studio-backdrop flex min-h-[460px] items-center justify-center px-4 py-8 sm:px-10 sm:py-12 lg:min-h-[calc(100vh-230px)]">
          <figure className="w-fit max-w-full bg-[#faf8f5] p-2.5 pb-9 shadow-[0_20px_60px_rgba(42,37,32,0.12)] sm:p-3 sm:pb-11 dark:bg-[#f2ece2] dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
            <Image
              src={generation.result_url}
              alt={t("imageAlt")}
              width={1600}
              height={1600}
              priority
              unoptimized
              className="max-h-[calc(100vh-310px)] min-h-[260px] w-auto max-w-full object-contain"
            />
            <figcaption
              className="mt-3 flex items-baseline justify-between gap-4 px-1 text-[11px] italic text-[#8a837a]"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              <span>{t("printLabel")}</span>
              <span>{formatDate(generation.created_at, locale)}</span>
            </figcaption>
          </figure>
        </section>

        <aside className="flex flex-col justify-between border-t border-[#d5cfc4] pt-7 dark:border-[#2a2520] lg:border-l lg:border-t-0 lg:py-2 lg:pl-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8a837a] dark:text-[#5c564e]">
              {t("eyebrow")}
            </p>
            <h1
              className="mt-5 text-[clamp(2rem,4vw,3.4rem)] italic leading-[0.95] text-[#2a2520] dark:text-[#c4bdb4]"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              {t("title")}
            </h1>
            <dl className="mt-10 border-y border-[#d5cfc4] py-5 dark:border-[#2a2520]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[10px] uppercase tracking-[0.22em] text-[#8a837a] dark:text-[#5c564e]">
                  {t("modelLabel")}
                </dt>
                <dd className="text-right text-[12px] tracking-wide">{modelName}</dd>
              </div>
            </dl>
            <p className="mt-5 text-[11px] leading-5 tracking-wide text-[#8a837a] dark:text-[#5c564e]">
              {t("promptPrivate")}
            </p>
          </div>

          <Link
            href="/generate"
            className="mt-10 flex items-center justify-between border-b border-[#2a2520] pb-3 text-[11px] font-medium uppercase tracking-[0.2em] transition-opacity hover:opacity-55 dark:border-[#c4bdb4]"
          >
            <span>{t("createCta")}</span>
            <span aria-hidden="true">↗</span>
          </Link>
        </aside>
      </main>
    </div>
  );
}
