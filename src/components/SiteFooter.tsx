import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;

type SiteFooterProps = {
  className?: string;
};

export default function SiteFooter({ className = "" }: SiteFooterProps) {
  return (
    <footer
      className={`border-t border-zinc-100 py-6 text-center text-xs text-zinc-400 dark:border-zinc-900 ${className}`.trim()}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-center gap-x-5 gap-y-2 px-6">
        {FOOTER_LINKS.map((link) => (
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
