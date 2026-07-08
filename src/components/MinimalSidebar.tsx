"use client";

import { useTranslations } from "next-intl";
import { useAppStore } from "@/store";
import { CATEGORIES, MODELS } from "@/lib/constants";

const TIME_FILTERS = [
  { slug: "today" as const },
  { slug: "week" as const },
  { slug: "month" as const },
];

const textBase =
  "w-full text-left text-[12px] tracking-wide text-[#5c564e] dark:text-[#7a7269] transition-colors duration-200";
const textHover = "hover:text-[#2a2520] dark:hover:text-[#c4bdb4]";
const textActive =
  "text-[#2a2520] dark:text-[#c4bdb4] underline underline-offset-4 decoration-[#2a2520] dark:decoration-[#c4bdb4]";
const arrowBase =
  "text-[10px] text-[#8a837a] dark:text-[#5c564e] opacity-0 group-hover:opacity-100 group-hover:text-[#2a2520] dark:group-hover:text-[#c4bdb4] transition-all duration-200 translate-x-0 group-hover:translate-x-0.5";

function MenuItem({
  label,
  onClick,
  isActive,
  arrow = true,
}: {
  label: string;
  onClick: () => void;
  isActive?: boolean;
  arrow?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center justify-between ${textBase} ${isActive ? textActive : textHover}`}
    >
      <span className="group-hover:translate-x-1 transition-transform duration-200 ease-out">
        {label}
      </span>
      {arrow && <span className={arrowBase}>›</span>}
    </button>
  );
}

export default function MinimalSidebar({
  onSearchClick,
}: {
  onSearchClick: () => void;
  isLoading?: boolean;
}) {
  const t = useTranslations("sidebar");
  const tCommon = useTranslations("common");
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

  return (
    <nav className="space-y-8">
      {/* Search */}
      <MenuItem
        label={
          searchQuery
            ? t("searchActive", { query: searchQuery })
            : t("search")
        }
        onClick={onSearchClick}
        arrow={true}
      />

      {/* Main actions */}
      <div className="space-y-3">
        <MenuItem
          label={t("all")}
          onClick={resetAll}
          isActive={activeCategory === "all" && activeTimeFilter === "all" && activeModel === "all" && !showFavoritesOnly}
        />
        <MenuItem
          label={t("surpriseMe")}
          onClick={() => {
            resetAll();
            const images = useAppStore.getState().allImages;
            if (images.length > 0) {
              const random = images[Math.floor(Math.random() * images.length)];
              useAppStore.getState().setSelectedImage(random);
            }
          }}
        />
        <MenuItem
          label={t("favorites")}
          onClick={toggleShowFavoritesOnly}
          isActive={showFavoritesOnly}
        />
      </div>

      {/* Time */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c] mb-1">{t("time")}</p>
        {TIME_FILTERS.map((tf) => (
          <MenuItem
            key={tf.slug}
            label={tCommon(`timeFilters.${tf.slug}`)}
            onClick={() => {
              setActiveTimeFilter(tf.slug);
              if (showFavoritesOnly) toggleShowFavoritesOnly();
            }}
            isActive={activeTimeFilter === tf.slug}
          />
        ))}
      </div>

      {/* Models */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c] mb-1">{t("models")}</p>
        {MODELS.map((model) => (
          <MenuItem
            key={model}
            label={model}
            onClick={() => {
              setActiveModel(activeModel === model ? "all" : model);
              if (showFavoritesOnly) toggleShowFavoritesOnly();
            }}
            isActive={activeModel === model}
          />
        ))}
      </div>

      {/* Categories */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c] mb-1">{t("categories")}</p>
        {CATEGORIES.filter((c) => c.slug !== "all").map((cat) => (
          <MenuItem
            key={cat.slug}
            label={tCommon(`categories.${cat.slug}`)}
            onClick={() => {
              setActiveCategory(cat.slug);
              setActiveModel("all");
              if (showFavoritesOnly) toggleShowFavoritesOnly();
            }}
            isActive={activeCategory === cat.slug}
          />
        ))}
      </div>
    </nav>
  );
}
