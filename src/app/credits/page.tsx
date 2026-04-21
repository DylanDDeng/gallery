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
function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const billingEnabled = isBillingEnabled();
  const standardModel = getModelPricing(STANDARD_MODEL_ID);
  const standardCreditsCost = getGenerationCreditsCost(
    STANDARD_MODEL_ID,
    STANDARD_RESOLUTION
  );

  const [purchasing, setPurchasing] = useState<
    CreditPackageCatalogItem["id"] | null
  >(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

    const status = (
      searchParams.get("payment_status") ??
      searchParams.get("status") ??
      ""
    ).toLowerCase();
    const success = searchParams.get("success");
    const orderId = searchParams.get("order_id");
    const canceled =
      searchParams.get("canceled") ?? searchParams.get("cancelled");

    if (
      success === "true" ||
      ["success", "paid", "completed"].includes(status)
    ) {
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
    } else if (
      canceled === "true" ||
      ["canceled", "cancelled", "failed"].includes(status)
    ) {
      setMessage({ type: "error", text: "Checkout was canceled." });
      router.replace("/credits");
    }
  }, [
    billingEnabled,
    fetchCredits,
    router,
    searchParams,
    waitForOrderCompletion,
  ]);

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
        setMessage({
          type: "error",
          text: json.error || "Failed to create order",
        });
        return;
      }

      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
      }
    } catch (error) {
      console.error("Error purchasing credits:", error);
      setMessage({
        type: "error",
        text: "An error occurred. Please try again.",
      });
    } finally {
      setPurchasing(null);
    }
  };

  if (!user || !billingEnabled) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 aspect-square w-[800px] -translate-x-1/2 rounded-full bg-indigo-400/10 blur-[120px] dark:bg-indigo-500/10" />
        <div className="absolute top-[40%] -left-[10%] aspect-square w-[500px] rounded-full bg-violet-400/8 blur-[100px] dark:bg-violet-500/8" />
        <div className="absolute top-[30%] -right-[10%] aspect-square w-[600px] rounded-full bg-fuchsia-400/8 blur-[100px] dark:bg-fuchsia-500/8" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to site
          </button>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm dark:border-white/10 dark:bg-zinc-900/80 sm:flex">
                <svg
                  className="h-4 w-4 text-amber-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  {credits?.toLocaleString() ?? "0"}
                </span>
                <span className="text-zinc-400 dark:text-zinc-500">
                  credits
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-16">
        {/* Page header */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">
            Credits
          </p>
          <h1
            className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            Top up your balance and keep creating
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            Purchase credits to generate images. No subscriptions, no monthly
            reset — your balance stays until you use it.
          </p>
        </div>

        {/* Balance card */}
        <div className="mx-auto mt-12 max-w-md">
          <div className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-8 text-center shadow-sm dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.07),_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.10),_transparent_60%)]" />
            <div className="relative">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 text-white shadow-lg dark:bg-white dark:text-zinc-900">
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-zinc-400">
                Your Balance
              </p>
              {credits === null ? (
                <div className="mx-auto mt-3 h-12 w-32 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
              ) : (
                <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
                  {credits ?? 0}
                </p>
              )}
              <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
                credits available
              </p>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={cn(
              "mx-auto mt-8 max-w-xl rounded-2xl border px-5 py-4 text-sm",
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300"
                : "border-red-200 bg-red-50 text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
            )}
          >
            <div className="flex items-start gap-3">
              {message.type === "success" ? (
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              {message.text}
            </div>
          </div>
        )}

        {/* Packages */}
        <div className="mx-auto mt-14 max-w-5xl">
          <p className="text-center text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">
            Purchase Credits
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {CREDIT_PACKAGE_CATALOG.map((pkg) => {
              const isPopular = pkg.id === "medium";
              const copy = PACKAGE_COPY[pkg.id];
              const disabled = purchasing !== null;

              return (
                <button
                  key={pkg.id}
                  onClick={() => void handlePurchase(pkg)}
                  disabled={disabled}
                  className={cn(
                    "group relative flex flex-col rounded-[28px] border p-7 text-left transition-all duration-300 disabled:opacity-60",
                    isPopular
                      ? "border-zinc-900 bg-zinc-900 text-white shadow-xl dark:border-white dark:bg-white dark:text-zinc-900"
                      : "border-zinc-200 bg-zinc-50/80 text-zinc-900 shadow-sm hover:-translate-y-1 hover:shadow-md dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100"
                  )}
                >
                  {purchasing === pkg.id && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[28px] bg-white/80 dark:bg-zinc-900/80">
                      <svg
                        className="h-5 w-5 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white shadow-md dark:bg-white dark:text-zinc-900">
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        Recommended
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium uppercase tracking-[0.18em]",
                          isPopular
                            ? "text-white/60 dark:text-zinc-500"
                            : "text-zinc-400 dark:text-zinc-500"
                        )}
                      >
                        {copy.label}
                      </p>
                      <p
                        className={cn(
                          "mt-3 max-w-[26ch] text-sm leading-6",
                          isPopular
                            ? "text-white/75 dark:text-zinc-600"
                            : "text-zinc-500 dark:text-zinc-400"
                        )}
                      >
                        {copy.blurb}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-right text-sm font-medium",
                        isPopular
                          ? "text-white/70 dark:text-zinc-500"
                          : "text-zinc-400 dark:text-zinc-500"
                      )}
                    >
                      {pkg.credits.toLocaleString()}
                      <span className="ml-0.5 font-normal">cr</span>
                    </p>
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-3">
                    <p className="text-5xl font-semibold tracking-tight">
                      {pkg.priceLabel}
                    </p>
                    <p
                      className={cn(
                        "text-sm",
                        isPopular
                          ? "text-white/50 dark:text-zinc-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      )}
                    >
                      ${(pkg.priceCents / 100 / pkg.credits).toFixed(3)}
                      /credit
                    </p>
                  </div>

                  <div
                    className={cn(
                      "mt-4 w-fit rounded-xl px-3 py-1.5 text-xs",
                      isPopular
                        ? "bg-white/10 text-white/80 dark:bg-zinc-950 dark:text-zinc-500"
                        : "bg-white text-zinc-500 shadow-sm dark:bg-zinc-800 dark:text-zinc-400"
                    )}
                  >
                    About {getApproximateRenderCount(pkg.credits).toLocaleString()}{" "}
                    {STANDARD_RESOLUTION} renders with {standardModel.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* How it works */}
        <div className="mx-auto mt-20 max-w-4xl">
          <p className="text-center text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">
            How it works
          </p>
          <div className="mt-12 grid gap-12 sm:grid-cols-3">
            {[
              {
                title: "Choose a bundle",
                desc: "Pick the credit package that fits your creative needs. All are one-time purchases.",
              },
              {
                title: "Pay securely",
                desc: "Complete checkout via our payment provider. Your transaction is encrypted and safe.",
              },
              {
                title: "Credits added instantly",
                desc: "Once payment is confirmed, your balance updates automatically. Start generating right away.",
              },
            ].map((item, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-6xl font-semibold leading-none tabular-nums text-zinc-200 dark:text-zinc-800">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Billing notes */}
        <div className="mx-auto mt-20 max-w-3xl border-t border-zinc-200 pt-12 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-zinc-400">
            Billing notes
          </p>
          <ul className="mt-6 space-y-3">
            <li>
              {standardModel.name} currently uses {standardCreditsCost} credits at{" "}
              {STANDARD_RESOLUTION}; 3K renders use more.
            </li>
            <li>Different models and output resolutions consume different credits.</li>
            <li>Payments are processed through a secure hosted checkout.</li>
            <li>Purchased credits do not expire.</li>
            <li>Contact support for refunds within 7 days of purchase.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
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
