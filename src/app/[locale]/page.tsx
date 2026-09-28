"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useRef } from "react";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import MasonryGrid from "@/components/MasonryGrid";
import MinimalSidebar from "@/components/MinimalSidebar";
import CategoryTabs from "@/components/CategoryTabs";
import HeaderCategories from "@/components/HeaderCategories";
import HomeHero from "@/components/HomeHero";
import ImageModal from "@/components/ImageModal";
import SearchModal from "@/components/SearchModal";
import UserMenu from "@/components/UserMenu";
import { useAppStore } from "@/store";
import { MAGAZINE_COVER_IMAGE } from "@/lib/constants";

export default function Home() {
  const tNav = useTranslations("nav");
  const tHome = useTranslations("home");
  const tCommon = useTranslations("common");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [categoryRowScrolledPast, setCategoryRowScrolledPast] = useState(false);
  const lastLoadedParamsRef = useRef({
    searchQuery: "__initial__",
    activeCategory: "__initial__",
    activeTimeFilter: "__initial__",
    activeModel: "__initial__",
    activeMjVersion: "__initial__",
    activeStyleKey: "__initial__",
    showFavoritesOnly: null as boolean | null,
  });

  const allImages = useAppStore((s) => s.allImages);
  const isLoading = useAppStore((s) => s.isLoading);
  const isLoadingMore = useAppStore((s) => s.isLoadingMore);
  const hasMore = useAppStore((s) => s.hasMore);
  const resetFeed = useAppStore((s) => s.resetFeed);
  const loadInitialPage = useAppStore((s) => s.loadInitialPage);
  const searchInput = useAppStore((s) => s.searchInput);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const activeModel = useAppStore((s) => s.activeModel);
  const activeMjVersion = useAppStore((s) => s.activeMjVersion);
  const activeStyleCode = useAppStore((s) => s.activeStyleCode);
  const setActiveStyleCode = useAppStore((s) => s.setActiveStyleCode);
  const activeStyleKey = activeStyleCode
    ? `${activeStyleCode.kind}:${activeStyleCode.code}`
    : "";
  const favoritesLoaded = useAppStore((s) => s.favoritesLoaded);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const favorites = useAppStore((s) => s.favorites);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const magazineOpened = useAppStore((s) => s.magazineOpened);
  const setMagazineOpened = useAppStore((s) => s.setMagazineOpened);
  const openGallery = useAppStore((s) => s.openGallery);

  // Keep keystrokes local; only the settled query reaches the feed and API.
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearchQuery(searchInput.trim());
    }, 275);
    return () => window.clearTimeout(id);
  }, [searchInput, setSearchQuery]);

  // Filter change → reset and reload (skip when returning with cached feed)
  useEffect(() => {
    if (!favoritesLoaded && showFavoritesOnly) return;

    const currentParams = {
      searchQuery,
      activeCategory,
      activeTimeFilter,
      activeModel,
      activeMjVersion,
      activeStyleKey,
      showFavoritesOnly,
    };

    const last = lastLoadedParamsRef.current;
    const isFirstMount = last.searchQuery === "__initial__";
    const paramsChanged =
      last.searchQuery !== searchQuery ||
      last.activeCategory !== activeCategory ||
      last.activeTimeFilter !== activeTimeFilter ||
      last.activeModel !== activeModel ||
      last.activeMjVersion !== activeMjVersion ||
      last.activeStyleKey !== activeStyleKey ||
      last.showFavoritesOnly !== showFavoritesOnly;

    if (!paramsChanged) return;

    // Returning to home with cached images for the current filters — reuse them
    if (isFirstMount && allImages.length > 0 && !isLoading) {
      lastLoadedParamsRef.current = currentParams;
      return;
    }

    // First mount with no cache, or filters actually changed
    if (showFavoritesOnly && favorites.length === 0) {
      resetFeed();
      lastLoadedParamsRef.current = currentParams;
      return;
    }

    resetFeed();
    loadInitialPage();
    lastLoadedParamsRef.current = currentParams;
  }, [
    searchQuery,
    activeCategory,
    activeTimeFilter,
    activeModel,
    activeMjVersion,
    activeStyleKey,
    showFavoritesOnly,
    favoritesLoaded,
    favorites.length,
    allImages.length,
    isLoading,
    resetFeed,
    loadInitialPage,
  ]);

  const handleCloseSearch = () => setSearchOpen(false);

  // Keyboard shortcut: / to toggle search
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f2ed] dark:bg-[#0c0b09] text-[#2a2520] dark:text-[#c4bdb4]">
      {/* Minimal Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 border-b transition-colors duration-300 ${
          magazineOpened && categoryRowScrolledPast
            ? "border-[#e0d9ce] bg-[#f5f2ed] dark:border-[#2a2520] dark:bg-[#0c0b09]"
            : "border-transparent bg-[#f5f2ed]/70 backdrop-blur-md dark:bg-[#0c0b09]/70"
        }`}
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          {/* The logo doubles as the way back to the top of the gallery. */}
          <Link
            href="/"
            onClick={(e) => {
              e.preventDefault();
              openGallery();
              requestAnimationFrame(() =>
                document
                  .getElementById("gallery")
                  ?.scrollIntoView({ behavior: "smooth" })
              );
            }}
            className="flex shrink-0 items-center gap-2 select-none"
          >
            <h1
              className="text-xl font-bold tracking-tight text-[#2a2520] dark:text-[#c4bdb4]"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              {tCommon("brand")}
            </h1>
          </Link>
          <HeaderCategories visible={magazineOpened && categoryRowScrolledPast} />
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/generate"
              aria-label={tNav("create")}
              className="flex h-10 w-10 items-center justify-center gap-2 rounded-[3px] bg-[#141210] text-[11px] tracking-[0.2em] text-[#f5f2ed] transition-colors hover:bg-[#2a2520] dark:bg-[#e0d9ce] dark:text-[#141210] dark:hover:bg-[#f5f2ed] sm:mr-2 sm:h-8 sm:w-auto sm:pl-3 sm:pr-3.5"
            >
              <svg
                className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeWidth={2} d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden sm:inline">{tNav("create")}</span>
            </Link>
            <LanguageSwitcher />
            <UserMenu />
            <button
              onClick={toggleTheme}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a837a] transition-colors hover:text-[#2a2520] hover:bg-[#e8e4de] dark:text-[#5c564e] dark:hover:text-[#c4bdb4] dark:hover:bg-[#1a1814]"
            >
              {theme === "light" ? (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Magazine Cover — flips open on click (skipped once already opened) */}
      {!magazineOpened && (
        <HomeHero
          coverImage={MAGAZINE_COVER_IMAGE}
          onOpen={() => setMagazineOpened(true)}
        />
      )}

      {/* Gallery Content */}
      <div className={`transition-opacity duration-500 ${magazineOpened ? 'opacity-100' : 'opacity-0'}`}>
        {/* Main Gallery */}
        <div
          id="gallery"
          className="mx-auto flex max-w-[1400px] scroll-mt-20 gap-12 px-6 py-16 lg:gap-20"
        >
          {/* Sidebar with collapse toggle */}
          <div className="hidden lg:flex flex-shrink-0">
            <aside
              className={`lg:sticky lg:top-[73px] lg:self-start transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden ${
                sidebarCollapsed ? "w-0 opacity-0" : "w-[200px] opacity-100"
              }`}
            >
              <MinimalSidebar
                onSearchClick={() => setSearchOpen(true)}
                isLoading={isLoading}
              />
            </aside>

            {/* Toggle sidebar button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-8 h-8 mt-1 ml-2 rounded-full text-[#8a837a] hover:text-[#2a2520] hover:bg-[#e8e4de] dark:text-[#5c564e] dark:hover:text-[#c4bdb4] dark:hover:bg-[#1a1814] transition-all duration-300 flex-shrink-0"
              title={
                sidebarCollapsed
                  ? tCommon("expandSidebar")
                  : tCommon("collapseSidebar")
              }
            >
              <svg
                className={`w-4 h-4 mx-auto transition-transform duration-300 ${
                  sidebarCollapsed ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          <main className="min-w-0 flex-1">
            <CategoryTabs onScrolledPastChange={setCategoryRowScrolledPast} />
            {/* The sidebar already shows and clears the style code; this bar
                covers mobile and the collapsed sidebar, where it is hidden. */}
            {activeStyleCode && (
              <div
                className={`mb-8 flex items-center gap-3 text-[11px] tracking-wide text-[#8a837a] dark:text-[#5c564e] ${
                  sidebarCollapsed ? "" : "lg:hidden"
                }`}
              >
                <span className="uppercase tracking-[0.2em] text-[10px]">
                  {tHome("styleFilterLabel")}
                </span>
                <span className="font-mono text-[12px] text-[#2a2520] dark:text-[#c4bdb4]">
                  --{activeStyleCode.kind} {activeStyleCode.code}
                </span>
                <button
                  onClick={() => setActiveStyleCode(null)}
                  className="underline underline-offset-4 hover:text-[#2a2520] dark:hover:text-[#c4bdb4] transition-colors"
                >
                  {tHome("clearFilter")}
                </button>
              </div>
            )}
            {isLoading && allImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 gap-8">
                {/* Photo developing animation */}
                <div className="relative">
                  {/* Photo frame with white border */}
                  <div className="relative w-48 h-64 bg-[#faf8f5] dark:bg-[#1a1814] p-2 shadow-lg">
                    {/* Inner photo area */}
                    <div className="relative w-full h-full bg-[#e8e4de] dark:bg-[#141210] overflow-hidden">
                      {/* Developing image effect */}
                      <div
                        className="absolute inset-0 bg-gradient-to-br from-[#c8c2b8] via-[#d5cfc4] to-[#c8c2b8] dark:from-[#2a2520] dark:via-[#3a352f] dark:to-[#2a2520]"
                        style={{
                          animation: "photo-develop 3s ease-in-out infinite"
                        }}
                      />
                      {/* Scan line */}
                      <div
                        className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent"
                        style={{
                          animation: "scan-line 2s ease-in-out infinite"
                        }}
                      />
                    </div>
                  </div>
                  {/* Shutter ring */}
                  <div
                    className="absolute -inset-3 border-2 border-[#d5cfc4] dark:border-[#3a352f] rounded-sm"
                    style={{
                      animation: "shutter-breathe 2s ease-in-out infinite"
                    }}
                  />
                </div>
                {/* Loading text */}
                <div className="text-center space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
                    {tHome("loadingGallery")}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-[#a39b90] dark:text-[#4a443c]">
                    {tHome("developingPhotos")}
                  </p>
                </div>
              </div>
            ) : (
              <MasonryGrid
                images={allImages}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                sidebarCollapsed={sidebarCollapsed}
              />
            )}
          </main>
        </div>

        <ImageModal />
        <SearchModal
          open={searchOpen}
          onClose={handleCloseSearch}
          isLoadingResults={
            Boolean(searchInput.trim()) &&
            (isLoading || searchInput.trim() !== searchQuery)
          }
        />

        {/* Minimal Footer */}
        <footer className="py-16 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
            {tHome("tagline")}
          </p>
        </footer>
      </div>
    </div>
  );
}
