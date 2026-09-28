"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppStore } from "@/store";
import { CATEGORIES } from "@/lib/constants";

/**
 * Category switcher shown in the header once the gallery's own category row
 * has scrolled away: a swipeable strip on desktop, the current category with
 * a menu on phones. The logo and header actions keep their space either way.
 */
export default function HeaderCategories({ visible }: { visible: boolean }) {
  const tCommon = useTranslations("common");
  const tHome = useTranslations("home");
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const toggleShowFavoritesOnly = useAppStore((s) => s.toggleShowFavoritesOnly);
  const stripRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const label = (slug: string) => tCommon(`categories.${slug}`);

  // Keep the active category in view inside the strip.
  useEffect(() => {
    if (!visible) return;
    stripRef.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [visible, activeCategory]);

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
    document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div
      aria-hidden={!visible}
      className={`flex min-w-0 flex-1 justify-center px-2 transition-opacity duration-300 md:px-8 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Desktop: swipeable strip */}
      <div
        ref={stripRef}
        className="scrollbar-hide hidden max-w-[720px] gap-6 overflow-x-auto md:flex"
      >
        {CATEGORIES.map((category) => {
          const isActive = activeCategory === category.slug;
          return (
            <button
              key={category.slug}
              onClick={() => pick(category.slug)}
              aria-pressed={isActive}
              tabIndex={visible ? 0 : -1}
              className={`shrink-0 whitespace-nowrap py-1 text-[12px] tracking-wide transition-colors ${
                isActive
                  ? "text-[#2a2520] underline decoration-[1.5px] underline-offset-[6px] dark:text-[#c4bdb4]"
                  : "text-[#6f685f] hover:text-[#2a2520] dark:text-[#7a7269] dark:hover:text-[#c4bdb4]"
              }`}
            >
              {label(category.slug)}
            </button>
          );
        })}
      </div>

      {/* Phone: current category with a menu */}
      <div ref={menuRef} className="relative min-w-0 md:hidden">
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={tHome("moreCategories")}
          tabIndex={visible ? 0 : -1}
          className="flex min-h-10 max-w-full items-center gap-1 whitespace-nowrap text-[13px] tracking-wide text-[#2a2520] dark:text-[#c4bdb4]"
        >
          <span className="truncate">{label(activeCategory)}</span>
          <svg
            className={`h-3 w-3 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`}
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
            className="absolute left-1/2 top-full z-50 mt-1 max-h-[60vh] min-w-44 -translate-x-1/2 overflow-y-auto rounded-[3px] border border-[#d5cfc4] bg-[#f5f2ed] py-2 dark:border-[#2a2520] dark:bg-[#0c0b09]"
          >
            {CATEGORIES.map((category) => {
              const isActive = activeCategory === category.slug;
              return (
                <button
                  key={category.slug}
                  role="menuitem"
                  onClick={() => pick(category.slug)}
                  className={`block w-full whitespace-nowrap px-4 py-2.5 text-left text-[14px] tracking-wide ${
                    isActive
                      ? "text-[#2a2520] underline underline-offset-4 dark:text-[#c4bdb4]"
                      : "text-[#5c564e] dark:text-[#7a7269]"
                  }`}
                >
                  {label(category.slug)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
