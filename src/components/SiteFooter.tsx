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
      className={`border-t border-zinc-100 py-6 text-center text-xs text-zinc-400 dark:border-zinc-900 ${className}`.trim()}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6">
        {footerLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </footer>
  );
}
