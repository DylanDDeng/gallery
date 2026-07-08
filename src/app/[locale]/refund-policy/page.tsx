import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import LegalPageShell from "@/components/LegalPageShell";
import LegalSections from "@/components/LegalSections";
import { isBillingEnabled } from "@/lib/billing-feature";

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
  const t = await getTranslations({ locale, namespace: "metadata.refund" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RefundPolicyPage() {
  if (!isBillingEnabled()) {
    notFound();
  }

  const t = await getTranslations("legal.refund");
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
