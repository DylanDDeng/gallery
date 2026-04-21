"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";
import {
  CREDIT_PACKAGE_CATALOG,
  type CreditPackageCatalogItem,
} from "@/lib/billing";
import {
  STANDARD_MODEL_ID,
  STANDARD_RESOLUTION,
  getApproximateRenderCount,
  getGenerationCreditsCost,
  getModelPricing,
} from "@/lib/model-pricing";
import { useAppStore } from "@/store";

const PACKAGE_COPY = {
  small: {
    label: "Starter",
    blurb: "For testing prompts and quick concept passes",
  },
  medium: {
    label: "Creator",
    blurb: "Best for regular generation and remix sessions",
  },
  large: {
    label: "Studio",
    blurb: "For larger batches and heavier creative output",
  },
} as const;

function CreditsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppStore((s) => s.user);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const credits = useAppStore((s) => s.credits);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const billingEnabled = isBillingEnabled();
  const standardModel = getModelPricing(STANDARD_MODEL_ID);
  const standardCreditsCost = getGenerationCreditsCost(
    STANDARD_MODEL_ID,
    STANDARD_RESOLUTION
  );

  const [purchasing, setPurchasing] = useState<CreditPackageCatalogItem["id"] | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const waitForOrderCompletion = useCallback(
    async (orderId: string) => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          const res = await fetch(`/api/orders/${orderId}`);
          const json = await res.json();

          if (!res.ok) {
            continue;
          }

          const status = json.order?.status;

          if (status === "completed") {
            setMessage({
              type: "success",
              text: "Purchase successful. Credits have been added to your account.",
            });
            await fetchCredits();
            return;
          }

          if (status === "failed") {
            setMessage({
              type: "error",
              text: "Payment failed. Please try again.",
            });
            return;
          }
        } catch (error) {
          console.error("Error checking order status:", error);
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      setMessage({
        type: "success",
        text: "Purchase submitted. Credits will appear once the payment is confirmed.",
      });
      await fetchCredits();
    },
    [fetchCredits]
  );

  useEffect(() => {
    if (!billingEnabled) {
      router.replace("/");
      return;
    }

    const status = (searchParams.get("payment_status") ?? searchParams.get("status") ?? "").toLowerCase();
    const success = searchParams.get("success");
    const orderId = searchParams.get("order_id");
    const canceled = searchParams.get("canceled") ?? searchParams.get("cancelled");

    if (success === "true" || ["success", "paid", "completed"].includes(status)) {
      setMessage({
        type: "success",
        text: "Purchase received. Credits will appear once the payment is confirmed.",
      });
      if (orderId) {
        void waitForOrderCompletion(orderId);
      } else {
        void fetchCredits();
      }
      router.replace("/credits");
    } else if (canceled === "true" || ["canceled", "cancelled", "failed"].includes(status)) {
      setMessage({ type: "error", text: "Checkout was canceled." });
      router.replace("/credits");
    }
  }, [billingEnabled, fetchCredits, router, searchParams, waitForOrderCompletion]);

  useEffect(() => {
    if (!authInitialized) {
      return;
    }

    if (!user) {
      router.replace("/");
      return;
    }

    if (!billingEnabled) {
      router.replace("/");
      return;
    }
  }, [authInitialized, billingEnabled, user, router]);

  const handlePurchase = async (pkg: CreditPackageCatalogItem) => {
    if (!user) {
      router.push("/");
      return;
    }

    setPurchasing(pkg.id);
    setMessage(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });

      const json = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: json.error || "Failed to create order" });
        return;
      }

      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      }
    } catch (error) {
      console.error("Error purchasing credits:", error);
      setMessage({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setPurchasing(null);
    }
  };

  if (!user || !billingEnabled) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              &larr; Back to site
            </button>
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Credits</h1>
          </div>
          <button
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {theme === "light" ? (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[800px] px-6 py-8">
        {/* Balance Card */}
        <div className="mb-8 rounded-2xl bg-zinc-900 dark:bg-zinc-800 p-8 text-center">
          <p className="text-sm font-medium text-zinc-400 dark:text-zinc-500 mb-2">Your Balance</p>
          {credits === null ? (
            <div className="h-12 w-32 mx-auto bg-zinc-700 dark:bg-zinc-700 rounded-lg animate-pulse" />
          ) : (
            <p className="text-5xl font-bold text-white">{credits ?? 0}</p>
          )}
          <p className="text-sm text-zinc-500 mt-1">credits</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-500 dark:text-red-400"
          }`}>
            {message.text}
          </div>
        )}

        {/* Packages */}
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Purchase Credits
        </h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {CREDIT_PACKAGE_CATALOG.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => void handlePurchase(pkg)}
              disabled={purchasing !== null}
              className={`group relative rounded-2xl p-6 text-left transition-all disabled:opacity-50 ${
                pkg.id === "medium"
                  ? "bg-zinc-900 text-white ring-1 ring-zinc-900 hover:ring-2 hover:ring-zinc-700 dark:bg-white dark:text-zinc-900 dark:ring-white"
                  : "bg-white dark:bg-zinc-900 ring-1 ring-zinc-200 dark:ring-white/10 hover:ring-2 hover:ring-zinc-300 dark:hover:ring-zinc-600"
              }`}
            >
              {purchasing === pkg.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 dark:bg-zinc-900/80">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-400" />
                </div>
              )}
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p
                    className={`text-xs font-medium uppercase tracking-[0.18em] ${
                      pkg.id === "medium"
                        ? "text-white/65 dark:text-zinc-500"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {PACKAGE_COPY[pkg.id].label}
                  </p>
                  <p
                    className={`mt-2 text-sm leading-6 ${
                      pkg.id === "medium"
                        ? "text-white/80 dark:text-zinc-600"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {PACKAGE_COPY[pkg.id].blurb}
                  </p>
                </div>
                {pkg.id === "medium" ? (
                  <span className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/82 dark:border-zinc-200 dark:text-zinc-700">
                    Recommended
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl font-bold">
                  {pkg.credits.toLocaleString()}
                </span>
                <span
                  className={`text-lg font-semibold ${
                    pkg.id === "medium"
                      ? "text-white/50 dark:text-zinc-500"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  credits
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-bold">
                  {pkg.priceLabel}
                </span>
                <span
                  className={`text-sm ${
                    pkg.id === "medium"
                      ? "text-white/62 dark:text-zinc-500"
                      : "text-zinc-400 dark:text-zinc-500"
                  }`}
                >
                  ${(pkg.priceCents / 100 / pkg.credits).toFixed(3)}/credit
                </span>
              </div>
              <div
                className={`mt-4 w-fit rounded-lg px-3 py-1.5 text-xs ${
                  pkg.id === "medium"
                    ? "bg-white/10 text-white/75 dark:bg-zinc-950 dark:text-zinc-600"
                    : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                About {getApproximateRenderCount(pkg.credits).toLocaleString()}{" "}
                {STANDARD_RESOLUTION} renders with {standardModel.name}.
              </div>
            </button>
          ))}
        </div>

        {/* Info */}
        <div className="mt-8 rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4 text-sm text-zinc-500 dark:text-zinc-400">
          <p className="mb-2 font-medium text-zinc-700 dark:text-zinc-300">How it works</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>
              {standardModel.name} currently uses {standardCreditsCost} credits at{" "}
              {STANDARD_RESOLUTION}; 3K renders use more.
            </li>
            <li>Different models and output resolutions consume different credits.</li>
            <li>Payments are processed through a secure hosted checkout</li>
            <li>Purchased credits do not expire</li>
            <li>Contact support for refunds within 7 days of purchase</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-400" />
    </div>
  );
}

export default function CreditsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CreditsContent />
    </Suspense>
  );
}
