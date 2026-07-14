"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { isPhoneAuthEnabled } from "@/lib/phone-auth-feature";
import { createClient } from "@/lib/supabase-browser";
import { useAppStore } from "@/store";
import PhoneOtpForm from "./PhoneOtpForm";

export default function LoginPrompt() {
  const t = useTranslations("auth.loginPrompt");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const showLoginPrompt = useAppStore((state) => state.showLoginPrompt);
  const loginPromptReason = useAppStore((state) => state.loginPromptReason);
  const setShowLoginPrompt = useAppStore((state) => state.setShowLoginPrompt);
  const [view, setView] = useState<"methods" | "phone">("methods");
  const phoneAuthEnabled = isPhoneAuthEnabled();

  if (!showLoginPrompt) return null;

  const reason = loginPromptReason ?? "favorites";

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", window.location.pathname);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo.toString() },
    });
  };

  const handleDismiss = () => {
    setView("methods");
    setShowLoginPrompt(false);
    if (reason === "generate") router.push("/");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label={tAuth("close")}
        className="absolute inset-0 bg-[#0c0b09]/55 backdrop-blur-sm"
        onClick={handleDismiss}
      />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#d5cfc4] bg-[#f5f2ed] p-6 shadow-[0_28px_90px_rgba(25,19,13,0.28)] dark:border-[#2a2520] dark:bg-[#141210]">
        <div aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#8a7d6e]/60 to-transparent" />
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#8a837a]">
          {tAuth("accessLabel")}
        </p>
        <h3 className="mt-2 text-lg font-semibold text-[#141210] dark:text-[#e0d9ce]">
          {view === "methods" ? t(`${reason}.title`) : tAuth("phone.loginTitle")}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#5c564e] dark:text-[#8a837a]">
          {view === "methods" ? t(`${reason}.description`) : tAuth("phone.loginDescription")}
        </p>

        {view === "phone" ? (
          <PhoneOtpForm
            flow="login"
            onSuccess={() => {
              setView("methods");
              setShowLoginPrompt(false);
            }}
            onCancel={() => setView("methods")}
          />
        ) : (
          <>
            {phoneAuthEnabled ? (
              <button
                type="button"
                onClick={() => setView("phone")}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#201c18] px-4 py-3 text-sm font-medium text-[#f4eee5] transition hover:bg-[#332d27] dark:bg-[#e0d9ce] dark:text-[#171411] dark:hover:bg-[#f0e9df]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zm2 15h4" />
                </svg>
                {tAuth("continueWithPhone")}
              </button>
            ) : null}
            {phoneAuthEnabled ? (
              <div className="my-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.16em] text-[#9b9389]">
                <span className="h-px flex-1 bg-[#d9d2c8] dark:bg-[#302b26]" />
                {tAuth("or")}
                <span className="h-px flex-1 bg-[#d9d2c8] dark:bg-[#302b26]" />
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => void handleGoogleSignIn()}
              className={`${phoneAuthEnabled ? "" : "mt-5"} flex w-full items-center justify-center gap-2 rounded-xl border border-[#d5cfc4] bg-[#f8f5f0] px-4 py-2.5 text-sm font-medium text-[#2a2520] shadow-sm transition-colors hover:bg-[#ebe7e0] dark:border-[#4a443c] dark:bg-[#1a1814] dark:text-[#d5cfc4] dark:hover:bg-[#2a2520]`}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {tAuth("continueWithGoogle")}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="mt-2 w-full py-2 text-xs text-[#8a837a] transition-colors hover:text-[#5c564e] dark:hover:text-[#a39b90]"
            >
              {t(`${reason}.dismiss`)}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
