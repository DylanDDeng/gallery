import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CREDIT_PACKAGE_CATALOG } from "@/lib/billing";
import { isBillingEnabled } from "@/lib/billing-feature";
import {
  STANDARD_MODEL_ID,
  STANDARD_RESOLUTION,
  getApproximateRenderCount,
  getGenerationCreditsCost,
  getModelPricing,
} from "@/lib/model-pricing";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Pricing — Aestara",
  description: "Public pricing for Aestara AI image generation credits.",
};

const PACKAGE_COPY = {
  small: {
    eyebrow: "Starter",
    blurb: "For testing prompts, quick concepts, and light iteration.",
  },
  medium: {
    eyebrow: "Creator",
    blurb: "The main bundle for regular image work and daily exploration.",
  },
  large: {
    eyebrow: "Studio",
    blurb: "For larger batches, heavier remixing, and more sustained output.",
  },
} as const;

export default function PricingPage() {
  if (!isBillingEnabled()) {
    notFound();
  }

  const standardModel = getModelPricing(STANDARD_MODEL_ID);
  const standardCreditsCost = getGenerationCreditsCost(
    STANDARD_MODEL_ID,
    STANDARD_RESOLUTION
  );

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

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">
            Aestara Pricing
          </p>
          <h1
            className="mt-4 text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            Choose a credit bundle that matches your creative pace
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            One-time credit purchases for image generation. No subscription required,
            no monthly reset, and credits stay available whenever you want to come back
            and create.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {CREDIT_PACKAGE_CATALOG.map((pkg) => (
            <div
              key={pkg.id}
              className={`rounded-[28px] border p-7 shadow-sm transition-colors ${
                pkg.id === "medium"
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                  : "border-zinc-200 bg-zinc-50/80 text-zinc-900 dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className={`text-sm font-medium uppercase tracking-[0.18em] ${
                      pkg.id === "medium"
                        ? "text-white/68 dark:text-zinc-500"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {PACKAGE_COPY[pkg.id].eyebrow}
                  </p>
                  <p
                    className={`mt-3 max-w-[24ch] text-sm leading-6 ${
                      pkg.id === "medium"
                        ? "text-white/82 dark:text-zinc-600"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {PACKAGE_COPY[pkg.id].blurb}
                  </p>
                </div>
                {pkg.id === "medium" ? (
                  <span className="rounded-full border border-white/18 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/82 dark:border-zinc-200 dark:text-zinc-700">
                    Most chosen
                  </span>
                ) : null}
              </div>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-5xl font-semibold tracking-tight">
                    {pkg.priceLabel}
                  </p>
                  <p
                    className={`mt-2 text-sm ${
                      pkg.id === "medium"
                        ? "text-white/68 dark:text-zinc-500"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    One-time purchase
                  </p>
                </div>
                <p
                  className={`text-right text-sm ${
                    pkg.id === "medium"
                      ? "text-white/74 dark:text-zinc-600"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {pkg.credits.toLocaleString()} credits
                </p>
              </div>
              <div
                className={`mt-6 rounded-2xl px-4 py-4 text-sm ring-1 ${
                  pkg.id === "medium"
                    ? "bg-white/8 text-white/82 ring-white/12 dark:bg-zinc-950 dark:text-zinc-600 dark:ring-zinc-200"
                    : "bg-white text-zinc-600 ring-zinc-200 dark:bg-zinc-950 dark:text-zinc-300 dark:ring-white/10"
                }`}
              >
                <p className="font-medium">Credits vary by model and resolution</p>
                <p className="mt-1">
                  About{" "}
                  <span className="font-semibold">
                    {getApproximateRenderCount(pkg.credits).toLocaleString()}
                  </span>{" "}
                  {STANDARD_RESOLUTION} renders with {standardModel.name} at{" "}
                  {standardCreditsCost} credits each.
                </p>
              </div>
              <Link
                href="/credits"
                className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full px-5 text-sm font-medium transition-colors ${
                  pkg.id === "medium"
                    ? "bg-white text-zinc-900 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
                    : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
                }`}
              >
                Buy {PACKAGE_COPY[pkg.id].eyebrow}
              </Link>
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
            <li>Different models and output resolutions consume different credits.</li>
            <li>Payments are processed through our secure checkout provider.</li>
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
