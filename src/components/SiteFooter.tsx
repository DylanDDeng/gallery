"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";

type SiteFooterProps = {
  className?: string;
};

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  const t = useTranslations("footer");

  const footerLinks = [
    ...(isBillingEnabled()
      ? ([
          { href: "/credits" as const, labelKey: "credits" as const },
          { href: "/refund-policy" as const, labelKey: "refundPolicy" as const },
        ] as const)
      : []),
    { href: "/terms" as const, labelKey: "terms" as const },
    { href: "/privacy" as const, labelKey: "privacy" as const },
  ] as const;

  return (
    <footer
      className={`border-t border-[#e0d9ce] py-6 text-center text-xs text-[#8a837a] dark:border-[#141210] ${className}`.trim()}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6">
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-[#4a443c] dark:hover:text-[#a39b90]"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </div>
    </footer>
  );
}
