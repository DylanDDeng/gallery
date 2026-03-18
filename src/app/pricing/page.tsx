import type { Metadata } from "next";
import Link from "next/link";
import { CREDIT_PACKAGE_CATALOG } from "@/lib/billing";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Pricing — Aestara",
  description: "Public pricing for Aestara AI image generation credits.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
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
          <Link
            href="/credits"
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Buy Credits
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
            Aestara Pricing
          </p>
          <h1
            className="mt-4 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            Credits for AI image generation
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Purchase one-time credit bundles and use them whenever you want. Under the
            current product model, one image generation uses one credit.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {CREDIT_PACKAGE_CATALOG.map((pkg) => (
            <div
              key={pkg.id}
              className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900/80"
            >
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-400">
                {pkg.id === "small" && "Starter"}
                {pkg.id === "medium" && "Popular"}
                {pkg.id === "large" && "Best Value"}
                {pkg.id === "pro" && "Power"}
              </p>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-4xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {pkg.priceLabel}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    ${(pkg.priceCents / 100 / pkg.credits).toFixed(3)} per credit
                  </p>
                </div>
                <p className="text-right text-sm text-zinc-500 dark:text-zinc-400">
                  {pkg.credits.toLocaleString()} credits
                </p>
              </div>
              <div className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-white/10">
                <p>
                  Good for{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {pkg.credits.toLocaleString()}
                  </span>{" "}
                  generations.
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-12 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-8 text-sm text-zinc-600 shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300">
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Billing notes
          </p>
          <ul className="mt-4 space-y-2">
            <li>Credit purchases are one-time transactions, not subscriptions.</li>
            <li>Purchased credits do not expire under the current product model.</li>
            <li>Payments are processed through Paddle.</li>
            <li>
              Refund requests can be submitted within 7 days. See{" "}
              <Link href="/refund-policy" className="underline underline-offset-2">
                refund policy
              </Link>
              .
            </li>
          </ul>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
