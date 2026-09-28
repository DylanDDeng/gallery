"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/store";
import { CATEGORIES } from "@/lib/constants";

const GAP_PX = 28;

const tabBase =
  "-mb-px flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-[1.5px] text-[14px] tracking-wide transition-colors md:text-[13px]";
const tabActive =
  "border-[#2a2520] text-[#2a2520] dark:border-[#c4bdb4] dark:text-[#c4bdb4]";
const tabIdle =
  "border-transparent text-[#6f685f] hover:text-[#2a2520] dark:text-[#7a7269] dark:hover:text-[#c4bdb4]";

export default function CategoryTabs({
  onScrolledPastChange,
}: {
  /** Reports when the row has scrolled up under the fixed header. */
  onScrolledPastChange?: (scrolledPast: boolean) => void;
}) {
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const toggleShowFavoritesOnly = useAppStore((s) => s.toggleShowFavoritesOnly);

  const rowRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState<number>(CATEGORIES.length);
  const [menuOpen, setMenuOpen] = useState(false);

  const labels = CATEGORIES.map((category) => tCommon(`categories.${category.slug}`));
  const labelsKey = labels.join("|");

  // Fit as many tabs as the row allows; the rest go behind "More".
  useLayoutEffect(() => {
    const row = rowRef.current;
    const measure = measureRef.current;
    if (!row || !measure) return;

    const fit = () => {
      const widths = Array.from(measure.children).map(
        (child) => (child as HTMLElement).offsetWidth
      );
      const moreWidth = widths.pop() ?? 0;
      const available = row.clientWidth;
      const total = widths.reduce((sum, width) => sum + width, 0) + GAP_PX * (widths.length - 1);
      if (total <= available) {
        setVisibleCount(widths.length);
        return;
      }

      let used = moreWidth;
      let count = 0;
      for (const width of widths) {
        if (used + GAP_PX + width > available) break;
        used += GAP_PX + width;
        count += 1;
      }
      setVisibleCount(Math.max(count, 1));
    };

    const observer = new ResizeObserver(fit);
    observer.observe(row);
    return () => observer.disconnect();
  }, [labelsKey]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !onScrolledPastChange) return;
    const headerHeight = document.querySelector("header")?.offsetHeight ?? 64;
    const observer = new IntersectionObserver(
      ([entry]) =>
        onScrolledPastChange(
          !entry.isIntersecting && entry.boundingClientRect.top < headerHeight
        ),
      { rootMargin: `-${headerHeight}px 0px 0px 0px` }
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [onScrolledPastChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setMenuOpen(false);
        return;
      }
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [menuOpen]);

  const pick = (slug: string) => {
    if (showFavoritesOnly) toggleShowFavoritesOnly();
    setActiveCategory(slug);
    setMenuOpen(false);
  };

  const shown = CATEGORIES.slice(0, visibleCount);
  const overflow = CATEGORIES.slice(visibleCount);
  const activeOverflow = overflow.find((category) => category.slug === activeCategory);
  const moreLabel = activeOverflow
    ? labels[CATEGORIES.indexOf(activeOverflow)]
    : tHome("more");

  return (
    <div ref={wrapperRef} className="relative mb-10">
      {/* Invisible copy of every label, used only to measure widths. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden"
      >
        {labels.map((label) => (
          <span key={label} className="whitespace-nowrap text-[14px] tracking-wide md:text-[13px]">
            {label}
          </span>
        ))}
        <span className="whitespace-nowrap pr-5 text-[14px] tracking-wide md:text-[13px]">
          {moreLabel}
        </span>
      </div>

      <div
        ref={rowRef}
        className="flex border-b border-[#e0d9ce] dark:border-[#2a2520]"
        style={{ gap: GAP_PX }}
      >
        {shown.map((category, index) => (
          <button
            key={category.slug}
            onClick={() => pick(category.slug)}
            aria-pressed={activeCategory === category.slug}
            className={`${tabBase} ${activeCategory === category.slug ? tabActive : tabIdle}`}
          >
            {labels[index]}
          </button>
        ))}

        {overflow.length > 0 && (
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label={tHome("moreCategories")}
              className={`${tabBase} gap-1.5 ${activeOverflow ? tabActive : tabIdle}`}
            >
              {moreLabel}
              <svg
                className={`h-3 w-3 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 min-w-44 rounded-[3px] border border-[#d5cfc4] bg-[#f5f2ed] py-2 dark:border-[#2a2520] dark:bg-[#0c0b09]"
              >
                {overflow.map((category) => {
                  const isActive = activeCategory === category.slug;
                  return (
                    <button
                      key={category.slug}
                      role="menuitem"
                      onClick={() => pick(category.slug)}
                      className={`block w-full whitespace-nowrap px-4 py-2 text-left text-[13px] tracking-wide transition-colors ${
                        isActive
                          ? "text-[#2a2520] underline underline-offset-4 dark:text-[#c4bdb4]"
                          : "text-[#5c564e] hover:bg-[#ebe7e0] hover:text-[#2a2520] dark:text-[#7a7269] dark:hover:bg-[#141210] dark:hover:text-[#c4bdb4]"
                      }`}
                    >
                      {labels[CATEGORIES.indexOf(category)]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
