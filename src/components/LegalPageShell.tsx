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
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
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
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400">
              Aestara Policies
            </p>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              AI image generation service
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-12">
          <h1
            className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
          <p className="mt-3 text-sm text-zinc-400">Last updated: {updatedAt}</p>
        </div>

        <div className="space-y-10">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}
