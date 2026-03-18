"use client";

import Link from "next/link";
import Script from "next/script";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const params = useParams<{ orderId: string }>();
  const searchParams = useSearchParams();
  const initializedRef = useRef(false);

  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const transactionId = searchParams.get("_ptxn");
  const paddleToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  const [scriptLoaded, setScriptLoaded] = useState(false);

  const error = useMemo(() => {
    if (!paddleToken) {
      return "Missing NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.";
    }

    if (!transactionId) {
      return "Missing Paddle transaction ID in the payment link.";
    }

    if (
      scriptLoaded &&
      typeof window !== "undefined" &&
      !(window as PaddleWindow).Paddle
    ) {
      return "Paddle.js failed to load.";
    }

    return null;
  }, [paddleToken, scriptLoaded, transactionId]);

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

    const successUrl = `${window.location.origin}/credits?success=true&order_id=${encodeURIComponent(orderId)}`;

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
  }, [error, orderId, paddleToken, scriptLoaded, transactionId]);

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
          Secure Checkout
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Complete your credit purchase</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Paddle Checkout should open automatically on this page.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl bg-zinc-50 px-4 py-4 text-sm text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {transactionId
              ? "If the checkout does not appear, verify that your Paddle website approval and client-side token are configured."
              : "This page is also safe to use as your default Paddle payment link."}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-4 text-sm">
          <Link
            href="/credits"
            className="font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Return to credits
          </Link>
          <span className="text-zinc-400 dark:text-zinc-500">Order {orderId}</span>
        </div>
      </div>
    </main>
  );
}
