import Link from "next/link";
import { isBillingEnabled } from "@/lib/billing-feature";

type SiteFooterProps = {
  className?: string;
};

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  const footerLinks = [
    ...(isBillingEnabled()
      ? ([
          { href: "/credits", label: "Credits" },
          { href: "/refund-policy", label: "Refund Policy" },
        ] as const)
      : []),
    { href: "/terms", label: "Terms of Service" },
    { href: "/privacy", label: "Privacy Policy" },
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
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
