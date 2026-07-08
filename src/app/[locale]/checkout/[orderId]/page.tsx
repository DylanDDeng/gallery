"use client";

import Script from "next/script";
import { useLocale, useTranslations } from "next-intl";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { Locale } from "@/i18n/routing";

type PaddleEvent = {
  name?: string;
};

type PaddleInitializeOptions = {
  token: string;
  checkout?: {
    settings?: {
      displayMode?: "overlay" | "inline";
      successUrl?: string;
      theme?: "light" | "dark";
    };
  };
  eventCallback?: (event: PaddleEvent) => void;
};

type PaddleWindow = Window & {
  Paddle?: {
    Environment: {
      set: (environment: "sandbox") => void;
    };
    Initialize: (options: PaddleInitializeOptions) => void;
  };
};

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const transactionId = searchParams.get("_ptxn");
  const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  const [scriptLoaded, setScriptLoaded] = useState(false);

  const error = useMemo(() => {
    if (!paddleToken) {
      return t("missingToken");
    }

    if (!transactionId) {
      return t("missingTransaction");
    }

    if (
      scriptLoaded &&
      typeof window !== "undefined" &&
      !(window as PaddleWindow).Paddle
    ) {
      return t("paddleLoadFailed");
    }

    return null;
  }, [paddleToken, scriptLoaded, t, transactionId]);

  useEffect(() => {
    if (!scriptLoaded || initializedRef.current || error) {
      return;
    }

    const paddle = (window as PaddleWindow).Paddle;
    if (!paddle || !paddleToken || !transactionId) {
      return;
    }

    if (paddleToken.startsWith("test_")) {
      paddle.Environment.set("sandbox");
    }

    const creditsPath = locale === "zh" ? "/zh/credits" : "/credits";
    const successUrl = `${window.location.origin}${creditsPath}?success=true&order_id=${encodeURIComponent(orderId)}`;

    paddle.Initialize({
      token: paddleToken,
      checkout: {
        settings: {
          displayMode: "overlay",
          successUrl,
          theme: "light",
        },
      },
    });

    initializedRef.current = true;
  }, [error, locale, orderId, paddleToken, scriptLoaded, transactionId]);

  return (
    <main className="min-h-screen bg-[#f5f2ed] px-6 py-16 text-[#141210] dark:bg-[#0c0b09] dark:text-[#e0d9ce]">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="mx-auto mb-8 flex max-w-xl justify-end">
        <LanguageSwitcher />
      </div>

      <div className="mx-auto max-w-xl rounded-3xl border border-[#d5cfc4] bg-[#f5f2ed] p-8 shadow-sm dark:border-[#f5f2ed]/10 dark:bg-[#141210]">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8a837a] dark:text-[#5c564e]">
          {t("label")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">{t("title")}</h1>
        <p className="mt-3 text-sm text-[#5c564e] dark:text-[#8a837a]">
          {t("subtitle")}
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-[#ebe7e0] px-4 py-4 text-sm text-[#5c564e] dark:bg-[#1a1814] dark:text-[#8a837a]">
            {transactionId ? t("verifyConfig") : t("defaultPaymentLink")}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-4 text-sm">
          <Link
            href="/credits"
            className="font-medium text-[#4a443c] hover:text-[#141210] dark:text-[#8a837a] dark:hover:text-[#e0d9ce]"
          >
            {t("returnToCredits")}
          </Link>
          <span className="text-[#8a837a] dark:text-[#5c564e]">
            {tCommon("orderLabel", { orderId })}
          </span>
        </div>
      </div>
    </main>
  );
}
