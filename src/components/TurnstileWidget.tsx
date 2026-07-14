"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme: "light" | "dark" | "auto";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function TurnstileWidget({
  onTokenChange,
  resetKey,
  unavailableLabel,
}: {
  onTokenChange: (token: string | null) => void;
  resetKey: number;
  unavailableLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  const renderWidget = useCallback(() => {
    if (!siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
      size: "flexible",
      callback: (token) => onTokenChange(token),
      "expired-callback": () => onTokenChange(null),
      "error-callback": () => onTokenChange(null),
    });
  }, [onTokenChange, siteKey]);

  useEffect(() => {
    if (!scriptReady) return;
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      onTokenChange(null);
    };
  }, [onTokenChange, renderWidget, resetKey, scriptReady]);

  if (!siteKey) {
    return (
      <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
        {unavailableLabel}
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
      />
      <div ref={containerRef} className="min-h-[65px] w-full overflow-hidden" />
    </>
  );
}
