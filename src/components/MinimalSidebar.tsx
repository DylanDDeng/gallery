"use client";

import { useAppStore } from "@/store";
import { CATEGORIES, MODELS } from "@/lib/constants";

export default function MinimalSidebar({
  onSearchClick,
  isLoading = false,
}: {
  onSearchClick: () => void;
  isLoading?: boolean;
}) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const setActiveCategory = useAppStore((s) => s.setActiveCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const setActiveTimeFilter = useAppStore((s) => s.setActiveTimeFilter);
  const activeModel = useAppStore((s) => s.activeModel);
  const setActiveModel = useAppStore((s) => s.setActiveModel);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const toggleShowFavoritesOnly = useAppStore((s) => s.toggleShowFavoritesOnly);

  const resetAll = () => {
    setActiveCategory("all");
    setActiveTimeFilter("all");
    setActiveModel("all");
    if (showFavoritesOnly) toggleShowFavoritesOnly();
  };

  const textBase = "text-[12px] tracking-wide text-[#5c564e] dark:text-[#7a7269] transition-colors duration-300";
  const textHover = "hover:text-[#2a2520] dark:hover:text-[#c4bdb4]";
  const textActive = "text-[#2a2520] dark:text-[#c4bdb4] underline underline-offset-4 decoration-[#2a2520] dark:decoration-[#c4bdb4]";

  return (
    <nav className="space-y-8">
      {/* Search */}
      <button
        onClick={onSearchClick}
        className={`${textBase} ${textHover} text-left`}
      >
        {searchQuery ? `Search: "${searchQuery}"` : "Search"}
      </button>

      {/* Main actions */}
      <div className="space-y-3">
        <button
          onClick={resetAll}
          className={`block ${textBase} ${activeCategory === "all" && activeTimeFilter === "all" && activeModel === "all" && !showFavoritesOnly ? textActive : textHover}`}
        >
          All
        </button>
        <button
          onClick={() => {
            resetAll();
            const images = useAppStore.getState().allImages;
            if (images.length > 0) {
              const random = images[Math.floor(Math.random() * images.length)];
              useAppStore.getState().setSelectedImage(random);
            }
          }}
          className={`block ${textBase} ${textHover}`}
        >
          Surprise Me
        </button>
        <button
          onClick={toggleShowFavoritesOnly}
          className={`block ${textBase} ${showFavoritesOnly ? textActive : textHover}`}
        >
          Favorites
        </button>
      </div>

      {/* Time */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c] mb-1">Time</p>
        {[
          { name: "Today", slug: "today" },
          { name: "This Week", slug: "week" },
          { name: "This Month", slug: "month" },
        ].map((tf) => (
          <button
            key={tf.slug}
            onClick={() => {
              setActiveTimeFilter(tf.slug as "today" | "week" | "month");
              if (showFavoritesOnly) toggleShowFavoritesOnly();
            }}
            className={`block ${textBase} ${activeTimeFilter === tf.slug ? textActive : textHover}`}
          >
            {tf.name}
          </button>
        ))}
      </div>

      {/* Models */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c] mb-1">Models</p>
        {MODELS.map((model) => (
          <button
            key={model}
            onClick={() => {
              setActiveModel(activeModel === model ? "all" : model);
              if (showFavoritesOnly) toggleShowFavoritesOnly();
            }}
            className={`block ${textBase} ${activeModel === model ? textActive : textHover}`}
          >
            {model}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c] mb-1">Categories</p>
        {CATEGORIES.filter((c) => c.slug !== "all").map((cat) => (
          <button
            key={cat.slug}
            onClick={() => {
              setActiveCategory(cat.slug);
              setActiveModel("all");
              if (showFavoritesOnly) toggleShowFavoritesOnly();
            }}
            className={`block ${textBase} ${activeCategory === cat.slug ? textActive : textHover}`}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </nav>
  );
}
