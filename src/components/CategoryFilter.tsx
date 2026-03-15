"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store";
import { CATEGORIES } from "@/lib/constants";

const TIME_FILTERS = [
  { name: "Today", slug: "today" },
  { name: "This Week", slug: "week" },
  { name: "This Month", slug: "month" },
] as const;

function getModelLogo(model: string): string {
  const m = model.toLowerCase();
  if (m.includes("z image")) return "/alibaba-color.svg";
  if (m.includes("seedream")) return "/bytedance-color.svg";
  if (m.includes("grok")) return "/grok-color.svg";
  if (m.includes("gpt")) return "/openai-color.svg";
  return "/nanobanana-color.svg";
}

export default function CategoryFilter() {
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const setActiveTimeFilter = useAppStore((s) => s.setActiveTimeFilter);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const toggleShowFavoritesOnly = useAppStore((s) => s.toggleShowFavoritesOnly);
  const allImages = useAppStore((s) => s.allImages);
  const activeModel = useAppStore((s) => s.activeModel);
  const setActiveModel = useAppStore((s) => s.setActiveModel);
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const [hasInteracted, setHasInteracted] = useState(false);

  const usedSlugs = useMemo(
    () => new Set(allImages.map((img) => img.category)),
    [allImages]
  );

  const visibleCategories = CATEGORIES.filter(
    (cat) => cat.slug !== "all" && usedSlugs.has(cat.slug)
  );

  const usedModels = useMemo(
    () => [...new Set(allImages.map((img) => img.model))],
    [allImages]
  );

  const isAll = activeCategory === "all" && activeTimeFilter === "all" && activeModel === "all" && hasInteracted;

  return (
    <nav className="space-y-4">
      {/* All */}
      <button
        onClick={() => {
          if (showFavoritesOnly) toggleShowFavoritesOnly();
          setActiveCategory("all");
          setActiveTimeFilter("all");
          setActiveModel("all");
          setHasInteracted(true);
        }}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all ${
          isAll
            ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-white"
            : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200"
        }`}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        All
      </button>

      {/* Surprise Me */}
      <button
        onClick={() => {
          if (showFavoritesOnly) toggleShowFavoritesOnly();
          setActiveCategory("all");
          setActiveTimeFilter("all");
          setActiveModel("all");
          if (allImages.length > 0) {
            const randomImage = allImages[Math.floor(Math.random() * allImages.length)];
            setSelectedImage(randomImage);
          }
        }}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-zinc-500 transition-all hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
        </svg>
        Surprise Me
      </button>

      {/* Time filter */}
      {TIME_FILTERS.length > 0 && (
        <>
          <div className="h-px bg-zinc-200 dark:bg-white/5" />
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
                    onClick={() => {
                      if (showFavoritesOnly) toggleShowFavoritesOnly();
                      setActiveTimeFilter(tf.slug as "all" | "today" | "week" | "month");
                      setActiveModel("all");
                      setHasInteracted(true);
                    }}
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
        </>
      )}

      {/* Models filter */}
      {usedModels.length > 0 && (
        <>
          <div className="h-px bg-zinc-200 dark:bg-white/5" />
          <div>
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
              Models
            </p>
            <div className="space-y-0.5">
              {usedModels.map((model) => {
                const isActive = activeModel === model;
                return (
                  <button
                    key={model}
                    onClick={() => {
                      if (showFavoritesOnly) toggleShowFavoritesOnly();
                      setActiveModel(isActive ? "all" : model);
                      setHasInteracted(true);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all ${
                      isActive
                        ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-white"
                        : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200"
                    }`}
                  >
                    <img
                      src={getModelLogo(model)}
                      alt=""
                      className="h-4 w-4 shrink-0"
                    />
                    {model}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Category filter */}
      {visibleCategories.length > 0 && (
        <>
          <div className="h-px bg-zinc-200 dark:bg-white/5" />
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
                    onClick={() => {
                      if (showFavoritesOnly) toggleShowFavoritesOnly();
                      setActiveCategory(cat.slug);
                      setActiveModel("all");
                      setHasInteracted(true);
                    }}
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
        </>
      )}
    </nav>
  );
}
