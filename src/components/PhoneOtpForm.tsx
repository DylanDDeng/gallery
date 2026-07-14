"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-browser";
import { getPhoneVerifyType, type PhoneAuthFlow } from "@/lib/phone-auth-flow";
import {
  PhoneAuthSessionError,
  requestPhoneOtpOperation,
  verifyPhoneOtpOperation,
} from "@/lib/phone-auth-operations";
import { maskPhone, normalizeMainlandPhone } from "@/lib/phone";
import { useAppStore } from "@/store";
import TurnstileWidget from "./TurnstileWidget";

const RESEND_SECONDS = 60;

function isPhoneConflict(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const value = `${error.code ?? ""} ${error.message ?? ""}`.toLowerCase();
  return /already|registered|exists|duplicate/.test(value);
}

function getSessionErrorKey(
  error: PhoneAuthSessionError,
): "errors.sessionExpired" | "errors.sessionChanged" {
  return error.code === "signed_out"
    ? "errors.sessionExpired"
    : "errors.sessionChanged";
}

export default function PhoneOtpForm({
  flow,
  onSuccess,
  onCancel,
}: {
  flow: PhoneAuthFlow;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("auth.phone");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bindingUserIdRef = useRef<string | null>(
    flow === "phone_change" ? (useAppStore.getState().user?.id ?? null) : null,
  );
  const phoneAuthConfigured = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim());

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [secondsLeft]);

  const handleCaptchaToken = useCallback((token: string | null) => {
    setCaptchaToken(token);
  }, []);

  const requestOtp = async () => {
    const phone = normalizeMainlandPhone(phoneInput);
    if (!phone) {
      setError(t("errors.invalidPhone"));
      return;
    }

    const expectedUserId = flow === "phone_change" ? bindingUserIdRef.current : null;
    if (flow === "login" && (!phoneAuthConfigured || !captchaToken)) {
      setError(t("errors.completeCaptcha"));
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      await requestPhoneOtpOperation({
        flow,
        expectedUserId,
        getUserId: async () => {
          const { data, error: userError } = await supabase.auth.getUser();
          if (userError && !isAuthSessionMissingError(userError)) throw userError;
          return data.user?.id ?? null;
        },
        signInWithOtp: async () => {
          const { error: requestError } = await supabase.auth.signInWithOtp({
            phone,
            options: { captchaToken: captchaToken!, shouldCreateUser: true },
          });
          if (requestError) throw requestError;
        },
        updatePhone: async () => {
          const { error: requestError } = await supabase.auth.updateUser({ phone });
          if (requestError) throw requestError;
        },
      });
      setNormalizedPhone(phone);
      setStage("otp");
      setSecondsLeft(RESEND_SECONDS);
    } catch (requestError) {
      if (requestError instanceof PhoneAuthSessionError) {
        setError(t(getSessionErrorKey(requestError)));
      } else if (
        flow === "phone_change" &&
        isPhoneConflict(requestError as { code?: string; message?: string })
      ) {
        setError(t("errors.phoneAlreadyUsed"));
      } else {
        setError(t("errors.sendFailed"));
      }
    } finally {
      if (flow === "login") {
        setCaptchaToken(null);
        setCaptchaResetKey((key) => key + 1);
      }
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    if (!normalizedPhone || !/^\d{6}$/.test(otp)) {
      setError(t("errors.invalidCode"));
      return;
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    try {
      await verifyPhoneOtpOperation({
        flow,
        expectedUserId: bindingUserIdRef.current,
        getUserId: async () => {
          const { data, error: userError } = await supabase.auth.getUser();
          if (userError && !isAuthSessionMissingError(userError)) throw userError;
          return data.user?.id ?? null;
        },
        verifyOtp: async () => {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            phone: normalizedPhone,
            token: otp,
            type: getPhoneVerifyType(flow),
          });
          if (verifyError) throw verifyError;
          return data.user;
        },
        signOut: async () => {
          await supabase.auth.signOut();
        },
      });
      onSuccess();
    } catch (verifyError) {
      if (verifyError instanceof PhoneAuthSessionError) {
        setError(t(getSessionErrorKey(verifyError)));
      } else if (
        flow === "phone_change" &&
        isPhoneConflict(verifyError as { code?: string; message?: string })
      ) {
        setError(t("errors.phoneAlreadyUsed"));
      } else {
        setError(t("errors.verifyFailed"));
      }
    } finally {
      setBusy(false);
    }
  };

  if (stage === "otp") {
    return (
      <div className="mt-5">
        <button
          type="button"
          onClick={() => {
            setStage("phone");
            setOtp("");
            setError(null);
          }}
          className="mb-4 text-xs text-[#6f675d] underline-offset-4 hover:underline dark:text-[#a39b90]"
        >
          {t("changePhone")}
        </button>
        <label className="block text-xs font-medium uppercase tracking-[0.16em] text-[#6f675d] dark:text-[#8a837a]">
          {t("codeLabel")}
        </label>
        <p className="mt-1 text-xs text-[#8a837a]">
          {t("codeSent", { phone: maskPhone(normalizedPhone ?? "") })}
        </p>
        <input
          autoFocus
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(event) => {
            if (event.key === "Enter") void verifyOtp();
          }}
          className="mt-3 w-full rounded-xl border border-[#cfc7bb] bg-[#fbf8f3] px-4 py-3 text-center text-xl tracking-[0.34em] text-[#201c18] outline-none transition focus:border-[#8d8174] focus:ring-2 focus:ring-[#8d8174]/15 dark:border-[#3a342e] dark:bg-[#0f0e0c] dark:text-[#ebe3d8]"
          aria-label={t("codeLabel")}
        />
        {flow === "login" && secondsLeft === 0 ? (
          <div className="mt-3">
            <TurnstileWidget
              onTokenChange={handleCaptchaToken}
              resetKey={captchaResetKey}
              unavailableLabel={t("errors.captchaUnavailable")}
            />
          </div>
        ) : null}
        {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="button"
          disabled={busy || otp.length !== 6}
          onClick={() => void verifyOtp()}
          className="mt-4 w-full rounded-xl bg-[#201c18] px-4 py-3 text-sm font-medium text-[#f4eee5] transition hover:bg-[#332d27] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#e0d9ce] dark:text-[#171411] dark:hover:bg-[#f0e9df]"
        >
          {busy ? t("verifying") : t(flow === "login" ? "signIn" : "confirmBinding")}
        </button>
        <button
          type="button"
          disabled={busy || secondsLeft > 0 || (flow === "login" && !captchaToken)}
          onClick={() => void requestOtp()}
          className="mt-2 w-full py-2 text-xs text-[#756d63] transition hover:text-[#3d3731] disabled:cursor-not-allowed disabled:opacity-45 dark:text-[#8a837a] dark:hover:text-[#bbb2a7]"
        >
          {secondsLeft > 0 ? t("resendCountdown", { seconds: secondsLeft }) : t("resend")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-5">
      <label className="block text-xs font-medium uppercase tracking-[0.16em] text-[#6f675d] dark:text-[#8a837a]">
        {t("phoneLabel")}
      </label>
      <div className="mt-2 flex overflow-hidden rounded-xl border border-[#cfc7bb] bg-[#fbf8f3] transition focus-within:border-[#8d8174] focus-within:ring-2 focus-within:ring-[#8d8174]/15 dark:border-[#3a342e] dark:bg-[#0f0e0c]">
        <span className="flex items-center border-r border-[#ddd6cc] px-3 text-sm text-[#5c544b] dark:border-[#302b26] dark:text-[#aaa197]">
          +86
        </span>
        <input
          autoFocus
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="138 0013 8000"
          value={phoneInput}
          onChange={(event) => setPhoneInput(event.target.value.slice(0, 20))}
          onKeyDown={(event) => {
            if (event.key === "Enter") void requestOtp();
          }}
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#201c18] outline-none dark:text-[#ebe3d8]"
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[#8a837a]">{t("mainlandOnly")}</p>
      {flow === "login" ? (
        <div className="mt-3">
          <TurnstileWidget
            onTokenChange={handleCaptchaToken}
            resetKey={captchaResetKey}
            unavailableLabel={t("errors.captchaUnavailable")}
          />
        </div>
      ) : null}
      {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      <button
        type="button"
        disabled={busy || (flow === "login" && (!captchaToken || !phoneAuthConfigured))}
        onClick={() => void requestOtp()}
        className="mt-4 w-full rounded-xl bg-[#201c18] px-4 py-3 text-sm font-medium text-[#f4eee5] transition hover:bg-[#332d27] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#e0d9ce] dark:text-[#171411] dark:hover:bg-[#f0e9df]"
      >
        {busy ? t("sending") : t("sendCode")}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="mt-2 w-full py-2 text-xs text-[#756d63] transition hover:text-[#3d3731] dark:text-[#8a837a] dark:hover:text-[#bbb2a7]"
      >
        {t("cancel")}
      </button>
    </div>
  );
}
