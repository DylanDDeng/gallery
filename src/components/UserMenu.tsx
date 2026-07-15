"use client";

import Image from "next/image";
import { ClockCounterClockwise, Heart, UserCircle } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isBillingEnabled } from "@/lib/billing-feature";
import { useAppStore } from "@/store";
import { createClient } from "@/lib/supabase-browser";
import { maskPhone } from "@/lib/phone";

export default function UserMenu() {
  const t = useTranslations("auth");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const user = useAppStore((s) => s.user);
  const credits = useAppStore((s) => s.credits);
  const favorites = useAppStore((s) => s.favorites);
  const setShowLoginPrompt = useAppStore((s) => s.setShowLoginPrompt);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const billingEnabled = isBillingEnabled();

  const avatarUrl =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture;
  const verifiedPhone = user?.phone_confirmed_at ? user.phone : undefined;
  const displayName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    (verifiedPhone ? maskPhone(verifiedPhone) : null) ||
    "User";

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    useAppStore.setState({ favorites: [], favoritesLoaded: false });
    setOpen(false);
  };

  if (!user) {
    return (
      <button
        onClick={() => setShowLoginPrompt(true, "account")}
        className="flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#4a443c] dark:text-[#a39b90] transition-colors hover:bg-[#e0d9ce] dark:hover:bg-[#1a1814]"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 8a3 3 0 10-6 0 3 3 0 006 0zm4 11a7 7 0 00-14 0" />
        </svg>
        {t("signIn")}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d5cfc4] dark:bg-[#2a2520] overflow-hidden transition-colors hover:bg-[#a39b90] dark:hover:bg-[#4a443c]"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" fill sizes="36px" className="object-cover" />
        ) : (
          <span className="text-xs font-semibold text-[#4a443c] dark:text-[#d5cfc4]">
            {displayName.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-[#d5cfc4] dark:border-[#2a2520] bg-[#f5f2ed] dark:bg-[#1a1814] shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e0d9ce] dark:border-[#2a2520]">
            <p className="text-sm font-medium text-[#141210] dark:text-[#e0d9ce] truncate">
              {displayName}
            </p>
            {user.email && (
              <p className="text-xs text-[#5c564e] dark:text-[#8a837a] truncate mt-0.5">
                {user.email}
              </p>
            )}
            {!user.email && verifiedPhone && (
              <p className="mt-0.5 truncate text-xs text-[#5c564e] dark:text-[#8a837a]">
                {maskPhone(verifiedPhone)}
              </p>
            )}
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[#4a443c] transition-colors hover:bg-[#ebe7e0] dark:text-[#a39b90] dark:hover:bg-[#2a2520]/50"
          >
            <UserCircle size={17} weight="light" aria-hidden />
            {tNav("profile")}
          </Link>
          <Link
            href="/history"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[#4a443c] transition-colors hover:bg-[#ebe7e0] dark:text-[#a39b90] dark:hover:bg-[#2a2520]/50"
          >
            <ClockCounterClockwise size={17} weight="light" aria-hidden />
            {tNav("history")}
          </Link>
          <Link
            href="/profile?tab=favorites"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[#4a443c] transition-colors hover:bg-[#ebe7e0] dark:text-[#a39b90] dark:hover:bg-[#2a2520]/50"
          >
            <Heart size={17} weight="light" aria-hidden />
            {t("favorites")}
            {favorites.length > 0 && (
              <span className="ml-auto rounded bg-[#d5cfc4] dark:bg-[#2a2520] px-1.5 py-0.5 text-[10px]">
                {favorites.length}
              </span>
            )}
          </Link>
          {billingEnabled && (
            <Link
              href="/credits"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[#4a443c] transition-colors hover:bg-[#ebe7e0] dark:text-[#a39b90] dark:hover:bg-[#2a2520]/50"
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
                  d="M12 8c-2.761 0-5 1.343-5 3s2.239 3 5 3 5-1.343 5-3-2.239-3-5-3zm0 0V6m0 8v2m-7-5v2c0 1.657 3.134 3 7 3s7-1.343 7-3v-2"
                />
              </svg>
              <span>{tNav("credits")}</span>
              <span className="ml-auto rounded bg-[#d5cfc4] px-1.5 py-0.5 text-[10px] dark:bg-[#2a2520]">
                {tCommon("creditsCount", { count: credits ?? "—" })}
              </span>
            </Link>
          )}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 text-left px-4 py-2.5 text-sm text-[#4a443c] dark:text-[#a39b90] hover:bg-[#ebe7e0] dark:hover:bg-[#2a2520]/50 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {tNav("settings")}
          </Link>
          <div className="border-t border-[#e0d9ce] dark:border-[#2a2520]" />
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-[#4a443c] dark:text-[#a39b90] hover:bg-[#ebe7e0] dark:hover:bg-[#2a2520]/50 transition-colors"
          >
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
