"use client";

import { useMemo } from "react";
import { useAppStore } from "@/store";
import { CATEGORIES } from "@/lib/constants";

export default function CategoryFilter() {
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
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
    <nav className="space-y-0.5">
      <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        Categories
      </p>
      {visibleCategories.map((cat) => {
        const isActive = activeCategory === cat.slug;
        return (
          <button
            key={cat.slug}
            onClick={() => setActiveCategory(cat.slug)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
              isActive
                ? "bg-white/10 text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isActive ? "bg-white" : "bg-transparent"
              }`}
            />
            {cat.name}
          </button>
        );
      })}
    </nav>
  );
}
