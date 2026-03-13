"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store";
import { CATEGORIES } from "@/lib/constants";

const TIME_FILTERS = [
  { name: "All", slug: "all" },
  { name: "Today", slug: "today" },
  { name: "This Week", slug: "week" },
  { name: "This Month", slug: "month" },
] as const;

export default function CategoryFilter() {
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const setActiveTimeFilter = useAppStore((s) => s.setActiveTimeFilter);
  const allImages = useAppStore((s) => s.allImages);

  const usedSlugs = useMemo(
    () => new Set(allImages.map((img) => img.category)),
    [allImages]
  );

  const visibleCategories = CATEGORIES.filter(
    (cat) => cat.slug === "all" || usedSlugs.has(cat.slug)
  );

  if (visibleCategories.length <= 1) return null;

  return (
    <nav className="space-y-4">
      {/* Time filter */}
      <div>
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Time
        </p>
        <div className="space-y-0.5">
          {TIME_FILTERS.map((tf) => {
            const isActive = activeTimeFilter === tf.slug;
            return (
              <button
                key={tf.slug}
                onClick={() => setActiveTimeFilter(tf.slug as "all" | "today" | "week" | "month")}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {tf.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-zinc-200 dark:bg-white/5" />

      {/* Category filter */}
      <div>
        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
          Categories
        </p>
        <div className="space-y-0.5">
          {visibleCategories.map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-white"
                    : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
