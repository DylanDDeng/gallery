"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh", label: "中文" },
];

function LanguageSwitcherInner() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLabel =
    LOCALE_OPTIONS.find((option) => option.value === locale)?.label ?? locale;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const switchLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) {
      setOpen(false);
      return;
    }

    const query = searchParams.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { locale: nextLocale });
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-[#d5cfc4] bg-[#f5f2ed] px-2.5 text-xs font-medium text-[#4a443c] transition-colors hover:bg-[#ebe7e0] dark:border-[#2a2520] dark:bg-[#1a1814] dark:text-[#a39b90] dark:hover:bg-[#2a2520]/50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{currentLabel}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-[5.5rem] overflow-hidden rounded-lg border border-[#d5cfc4] bg-[#f5f2ed] shadow-lg dark:border-[#2a2520] dark:bg-[#1a1814]"
        >
          {LOCALE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={locale === option.value}
              onClick={() => switchLocale(option.value)}
              className={`block w-full px-3 py-2 text-left text-xs transition-colors ${
                locale === option.value
                  ? "bg-[#ebe7e0] font-medium text-[#2a2520] dark:bg-[#2a2520]/50 dark:text-[#e0d9ce]"
                  : "text-[#4a443c] hover:bg-[#ebe7e0] dark:text-[#a39b90] dark:hover:bg-[#2a2520]/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LanguageSwitcherFallback() {
  const locale = useLocale() as Locale;
  const currentLabel =
    LOCALE_OPTIONS.find((option) => option.value === locale)?.label ?? locale;

  return (
    <button
      type="button"
      disabled
      className="flex h-8 items-center gap-1.5 rounded-lg border border-[#d5cfc4] bg-[#f5f2ed] px-2.5 text-xs font-medium text-[#4a443c] opacity-70 dark:border-[#2a2520] dark:bg-[#1a1814] dark:text-[#a39b90]"
    >
      <span>{currentLabel}</span>
    </button>
  );
}

export default function LanguageSwitcher() {
  return (
    <Suspense fallback={<LanguageSwitcherFallback />}>
      <LanguageSwitcherInner />
    </Suspense>
  );
}
