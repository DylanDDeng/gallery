import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import { hasLocale } from "next-intl";
import type { Metadata } from "next";
import Providers from "@/components/Providers";
import { isBillingEnabled } from "@/lib/billing-feature";
import { routing } from "@/i18n/routing";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getTranslations } from "next-intl/server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    metadataBase: new URL("https://www.aestara.art"),
    title: t("title"),
    description: t("description"),
    icons: {
      icon: "/favicon.ico",
      apple: "/apple-icon.png",
    },
    openGraph: {
      title: t("title"),
      description: t("description"),
      images: ["/opengraph-image.png"],
      locale: locale === "zh" ? "zh_CN" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("description"),
      images: ["/opengraph-image.png"],
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialCredits: number | null = null;

  if (user && isBillingEnabled()) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", user.id)
      .single();

    initialCredits = profile?.credits ?? 0;
  }

  const initialUser = user
    ? {
        id: user.id,
        email: user.email,
        user_metadata: {
          name: user.user_metadata?.name,
          avatar_url: user.user_metadata?.avatar_url,
          full_name: user.user_metadata?.full_name,
          picture: user.user_metadata?.picture,
        },
      }
    : null;

  return (
    <NextIntlClientProvider messages={messages}>
      <Providers initialUser={initialUser} initialCredits={initialCredits}>
        {children}
      </Providers>
      <Script
        defer
        src="https://cloud.umami.is/script.js"
        data-website-id="d6584f0c-286d-42d7-a9f4-ac20093c3865"
        strategy="afterInteractive"
      />
    </NextIntlClientProvider>
  );
}
