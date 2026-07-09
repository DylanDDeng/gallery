"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { isBillingEnabled } from "@/lib/billing-feature";
import {
  CREDIT_PACKAGE_CATALOG,
  type CreditPackageCatalogItem,
} from "@/lib/billing";
import {
  STANDARD_MODEL_ID,
  STANDARD_TIER_ID,
  getApproximateRenderCount,
  getGenerationCreditsCost,
  getModelPricing,
} from "@/lib/model-pricing";
import { translateError } from "@/lib/translate-error";
import { useAppStore } from "@/store";

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function CreditsContent() {
  const t = useTranslations("credits");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppStore((s) => s.user);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const credits = useAppStore((s) => s.credits);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const openGallery = useAppStore((s) => s.openGallery);
  const billingEnabled = isBillingEnabled();
  const standardModel = getModelPricing(STANDARD_MODEL_ID);
  const standardCreditsCost = getGenerationCreditsCost(
    STANDARD_MODEL_ID,
    STANDARD_TIER_ID
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
              text: t("messages.purchaseSuccess"),
            });
            await fetchCredits();
            return;
          }

          if (status === "failed") {
            setMessage({
              type: "error",
              text: t("messages.paymentFailed"),
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
        text: t("messages.purchaseSubmitted"),
      });
      await fetchCredits();
    },
    [fetchCredits, t]
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
        text: t("messages.purchaseReceived"),
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
      setMessage({ type: "error", text: t("messages.checkoutCanceled") });
      router.replace("/credits");
    }
  }, [
    billingEnabled,
    fetchCredits,
    router,
    searchParams,
    t,
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
          text:
            translateError(tErrors, json.errorCode, json.error) ||
            t("messages.failedToCreateOrder"),
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
        text: t("messages.genericError"),
      });
    } finally {
      setPurchasing(null);
    }
  };

  if (!user || !billingEnabled) {
    return null;
  }

  const billingSteps = [
    {
      title: t("steps.choose.title"),
      desc: t("steps.choose.desc"),
    },
    {
      title: t("steps.pay.title"),
      desc: t("steps.pay.desc"),
    },
    {
      title: t("steps.added.title"),
      desc: t("steps.added.desc"),
    },
  ];

  const billingNotes = [
    t("billingItems.standardModel", {
      model: standardModel.name,
      credits: standardCreditsCost ?? 0,
    }),
    t("billingItems.gptImage"),
    t("billingItems.differentModels"),
    t("billingItems.secureCheckout"),
    t("billingItems.noExpiry"),
    t("billingItems.refundContact"),
  ];

  return (
    <div className="relative min-h-screen bg-[#f5f2ed] text-[#141210] dark:bg-[#0c0b09] dark:text-[#e0d9ce]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[20%] left-1/2 aspect-square w-[800px] -translate-x-1/2 rounded-full bg-indigo-400/10 blur-[120px] dark:bg-indigo-500/10" />
        <div className="absolute top-[40%] -left-[10%] aspect-square w-[500px] rounded-full bg-violet-400/8 blur-[100px] dark:bg-violet-500/8" />
        <div className="absolute top-[30%] -right-[10%] aspect-square w-[600px] rounded-full bg-fuchsia-400/8 blur-[100px] dark:bg-fuchsia-500/8" />
      </div>

      <header className="sticky top-0 z-40 border-b border-[#d5cfc4] bg-[#f5f2ed]/80 backdrop-blur-xl dark:border-[#f5f2ed]/5 dark:bg-[#0c0b09]/80">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <button
            onClick={() => {
              openGallery();
              router.push("/");
            }}
            className="flex items-center gap-2 text-sm text-[#8a837a] transition-colors hover:text-[#4a443c] dark:text-[#5c564e] dark:hover:text-[#a39b90]"
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
            {t("backToSite")}
          </button>

          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            {user && (
              <div className="hidden items-center gap-2 rounded-full border border-[#d5cfc4] bg-[#ebe7e0] px-3 py-1.5 text-sm dark:border-[#f5f2ed]/10 dark:bg-[#141210]/80 sm:flex">
                <svg
                  className="h-4 w-4 text-amber-500"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="font-medium text-[#2a2520] dark:text-[#d5cfc4]">
                  {credits?.toLocaleString() ?? "0"}
                </span>
                <span className="text-[#8a837a] dark:text-[#5c564e]">
                  {tCommon("credits")}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-6xl px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8a837a]">
            {t("label")}
          </p>
          <h1
            className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl"
            style={{ fontFamily: "'Caveat', cursive" }}
          >
            {t("title")}
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#5c564e] dark:text-[#8a837a]">
            {t("subtitle")}
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-md">
          <div className="relative overflow-hidden rounded-[28px] border border-[#d5cfc4] bg-gradient-to-br from-[#ebe7e0] to-white p-8 text-center shadow-sm dark:border-[#f5f2ed]/10 dark:from-[#141210] dark:to-[#0c0b09]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.07),_transparent_60%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.10),_transparent_60%)]" />
            <div className="relative">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#141210] text-[#f5f2ed] shadow-lg dark:bg-[#f5f2ed] dark:text-[#141210]">
                <svg
                  className="h-7 w-7"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em] text-[#8a837a]">
                {t("yourBalance")}
              </p>
              {credits === null ? (
                <div className="mx-auto mt-3 h-12 w-32 animate-pulse rounded-xl bg-[#d5cfc4] dark:bg-[#1a1814]" />
              ) : (
                <p className="mt-2 text-5xl font-semibold tracking-tight tabular-nums">
                  {credits ?? 0}
                </p>
              )}
              <p className="mt-1 text-sm text-[#8a837a] dark:text-[#5c564e]">
                {t("creditsAvailable")}
              </p>
            </div>
          </div>
        </div>

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

        <div className="mx-auto mt-14 max-w-5xl">
          <p className="text-center text-xs font-medium uppercase tracking-[0.24em] text-[#8a837a]">
            {t("purchaseCredits")}
          </p>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {CREDIT_PACKAGE_CATALOG.map((pkg) => {
              const isPopular = pkg.id === "medium";
              const disabled = purchasing !== null;

              return (
                <button
                  key={pkg.id}
                  onClick={() => void handlePurchase(pkg)}
                  disabled={disabled}
                  className={cn(
                    "group relative flex flex-col rounded-[28px] border p-7 text-left transition-all duration-300 focus:outline-none",
                    isPopular
                      ? "border-[#141210] bg-[#141210] text-[#f5f2ed] shadow-xl active:scale-[0.98] dark:border-[#f5f2ed] dark:bg-[#f5f2ed] dark:text-[#141210]"
                      : "border-[#d5cfc4] bg-[#ebe7e0]/80 text-[#141210] shadow-sm hover:-translate-y-1 hover:shadow-md active:scale-[0.98] dark:border-[#f5f2ed]/10 dark:bg-[#141210]/80 dark:text-[#e0d9ce]",
                    disabled && purchasing !== pkg.id && "cursor-not-allowed opacity-40",
                    disabled && purchasing === pkg.id && "cursor-wait"
                  )}
                >
                  {purchasing === pkg.id && (
                    <div
                      className={cn(
                        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[28px]",
                        isPopular
                          ? "bg-[#141210] dark:bg-[#f5f2ed]"
                          : "bg-[#f5f2ed] dark:bg-[#141210]"
                      )}
                    >
                      <svg
                        className={cn(
                          "h-5 w-5 animate-spin",
                          isPopular
                            ? "text-[#f5f2ed] dark:text-[#141210]"
                            : "text-[#141210] dark:text-[#f5f2ed]"
                        )}
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
                      <span
                        className={cn(
                          "text-xs font-medium tracking-wide",
                          isPopular
                            ? "text-[#f5f2ed]/70 dark:text-[#141210]/70"
                            : "text-[#5c564e] dark:text-[#8a837a]"
                        )}
                      >
                        {tCommon("processing")}
                      </span>
                    </div>
                  )}

                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 z-20 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#141210] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#f5f2ed] shadow-md dark:bg-[#f5f2ed] dark:text-[#141210]">
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {tCommon("recommended")}
                      </span>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium uppercase tracking-[0.18em]",
                          isPopular
                            ? "text-[#f5f2ed]/60 dark:text-[#5c564e]"
                            : "text-[#8a837a] dark:text-[#5c564e]"
                        )}
                      >
                        {t(`packages.${pkg.id}.label`)}
                      </p>
                      <p
                        className={cn(
                          "mt-3 max-w-[26ch] text-sm leading-6",
                          isPopular
                            ? "text-[#f5f2ed]/75 dark:text-[#4a443c]"
                            : "text-[#5c564e] dark:text-[#8a837a]"
                        )}
                      >
                        {t(`packages.${pkg.id}.blurb`)}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-right text-sm font-medium",
                        isPopular
                          ? "text-[#f5f2ed]/70 dark:text-[#5c564e]"
                          : "text-[#8a837a] dark:text-[#5c564e]"
                      )}
                    >
                      {pkg.credits.toLocaleString()}
                      <span className="ml-0.5 font-normal">{tCommon("cr")}</span>
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
                          ? "text-[#f5f2ed]/50 dark:text-[#8a837a]"
                          : "text-[#8a837a] dark:text-[#5c564e]"
                      )}
                    >
                      ${(pkg.priceCents / 100 / pkg.credits).toFixed(3)}
                      {tCommon("perCredit")}
                    </p>
                  </div>

                  <div
                    className={cn(
                      "mt-4 w-fit rounded-xl px-3 py-1.5 text-xs",
                      isPopular
                        ? "bg-[#f5f2ed]/10 text-[#f5f2ed]/80 dark:bg-[#0c0b09] dark:text-[#5c564e]"
                        : "bg-[#f5f2ed] text-[#5c564e] shadow-sm dark:bg-[#1a1814] dark:text-[#8a837a]"
                    )}
                  >
                    {t("approximateRenders", {
                      count: getApproximateRenderCount(pkg.credits).toLocaleString(),
                      model: standardModel.name,
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-4xl">
          <p className="text-center text-xs font-medium uppercase tracking-[0.24em] text-[#8a837a]">
            {t("howItWorks")}
          </p>
          <div className="mt-12 grid gap-12 sm:grid-cols-3">
            {billingSteps.map((item, i) => (
              <div key={i} className="flex flex-col">
                <span className="text-6xl font-semibold leading-none tabular-nums text-[#d5cfc4] dark:text-[#1a1814]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="mt-4 text-sm font-medium text-[#141210] dark:text-[#e0d9ce]">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#5c564e] dark:text-[#8a837a]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-3xl border-t border-[#d5cfc4] pt-12 text-sm text-[#5c564e] dark:border-[#f5f2ed]/10 dark:text-[#8a837a]">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#8a837a]">
            {t("billingNotes")}
          </p>
          <ul className="mt-6 space-y-3">
            {billingNotes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

function LoadingFallback() {
  const tCommon = useTranslations("common");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f2ed] dark:bg-[#0c0b09]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#d5cfc4] dark:border-[#2a2520] border-t-[#8a837a]" />
      <span className="sr-only">{tCommon("loading")}</span>
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
