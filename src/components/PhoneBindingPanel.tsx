"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { isPhoneAuthEnabled } from "@/lib/phone-auth-feature";
import { maskPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase-browser";
import { useAppStore } from "@/store";
import PhoneOtpForm from "./PhoneOtpForm";

export default function PhoneBindingPanel() {
  const t = useTranslations("settings.account.phone");
  const user = useAppStore((state) => state.user);
  const [editing, setEditing] = useState(false);

  if (!user || !isPhoneAuthEnabled()) return null;
  const verifiedPhone = user.phone_confirmed_at ? user.phone : undefined;

  const handleSuccess = async () => {
    const { data } = await createClient().auth.getUser();
    if (data.user) {
      useAppStore.getState().setUser(data.user);
    }
    setEditing(false);
  };

  return (
    <div className="mt-5 border-t border-[#d5cfc4] pt-5 dark:border-[#2a2520]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#141210] dark:text-[#e0d9ce]">{t("title")}</p>
          <p className="mt-1 text-xs leading-relaxed text-[#5c564e] dark:text-[#8a837a]">
            {verifiedPhone ? maskPhone(verifiedPhone) : t("notBound")}
          </p>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-lg border border-[#cfc7bb] bg-[#f5f2ed] px-3 py-2 text-xs font-medium text-[#3f3933] transition hover:bg-[#e4ded5] dark:border-[#38322c] dark:bg-[#1a1814] dark:text-[#b8afa4] dark:hover:bg-[#28231f]"
          >
            {verifiedPhone ? t("change") : t("bind")}
          </button>
        ) : null}
      </div>
      {editing ? (
        <PhoneOtpForm
          key={user.id}
          flow="phone_change"
          onSuccess={() => void handleSuccess()}
          onCancel={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
