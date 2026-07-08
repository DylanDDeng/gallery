import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LegalPageShell from "@/components/LegalPageShell";
import LegalSections from "@/components/LegalSections";

type LegalSection = {
  heading: string;
  paragraphs?: string[];
  items?: string[];
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.terms" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  const sections = t.raw("sections") as LegalSection[];

  return (
    <LegalPageShell
      title={t("title")}
      description={t("description")}
      updatedAt={t("updatedAt")}
    >
      <LegalSections sections={sections} />
    </LegalPageShell>
  );
}
