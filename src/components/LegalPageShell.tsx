import Link from "next/link";
import type { ReactNode } from "react";
import SiteFooter from "@/components/SiteFooter";

type LegalPageShellProps = {
  title: string;
  description: string;
  updatedAt: string;
  children: ReactNode;
};

export default function LegalPageShell({
  title,
  description,
  updatedAt,
  children,
}: LegalPageShellProps) {
  return (
    <div className="min-h-screen bg-[#f5f2ed] dark:bg-[#0c0b09]">
      <header className="sticky top-0 z-40 border-b border-[#d5cfc4] bg-[#f5f2ed]/80 backdrop-blur-xl dark:border-[#f5f2ed]/5 dark:bg-[#0c0b09]/80">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-[#8a837a] transition-colors hover:text-[#4a443c] dark:hover:text-[#a39b90]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Aestara
          </Link>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8a837a]">
              Aestara Policies
            </p>
            <p className="text-[11px] text-[#8a837a] dark:text-[#5c564e]">
              AI image generation service
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-12">
          <h1
            className="text-4xl font-bold tracking-tight text-[#141210] dark:text-[#e0d9ce]"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#5c564e] dark:text-[#8a837a]">
            {description}
          </p>
          <p className="mt-3 text-sm text-[#8a837a]">Last updated: {updatedAt}</p>
        </div>

        <div className="space-y-10">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
