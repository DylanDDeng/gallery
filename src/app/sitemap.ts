import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const BASE_URL = "https://www.aestara.art";

const MAIN_PAGES = [
  "",
  "/generate",
  "/history",
  "/credits",
  "/settings",
  "/terms",
  "/privacy",
  "/refund-policy",
] as const;

function getLocalizedPath(locale: string, path: string) {
  if (locale === routing.defaultLocale) {
    return path || "/";
  }

  return path ? `/${locale}${path}` : `/${locale}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return routing.locales.flatMap((locale) =>
    MAIN_PAGES.map((path) => ({
      url: `${BASE_URL}${getLocalizedPath(locale, path)}`,
      lastModified,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((altLocale) => [
            altLocale,
            `${BASE_URL}${getLocalizedPath(altLocale, path)}`,
          ])
        ),
      },
    }))
  );
}
