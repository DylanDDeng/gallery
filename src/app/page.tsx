"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import MasonryGrid from "@/components/MasonryGrid";
import MinimalSidebar from "@/components/MinimalSidebar";
import ImageModal from "@/components/ImageModal";
import SearchModal from "@/components/SearchModal";
import UserMenu from "@/components/UserMenu";
import LoginPrompt from "@/components/LoginPrompt";
import { useAppStore } from "@/store";
import { hydrateImageDimensions } from "@/lib/image-dimensions";

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const initialLoadRef = useRef(false);

  const allImages = useAppStore((s) => s.allImages);
  const isLoading = useAppStore((s) => s.isLoading);
  const isLoadingMore = useAppStore((s) => s.isLoadingMore);
  const hasMore = useAppStore((s) => s.hasMore);
  const feedVersion = useAppStore((s) => s.feedVersion);
  const resetFeed = useAppStore((s) => s.resetFeed);
  const loadInitialPage = useAppStore((s) => s.loadInitialPage);
  const setAllImages = useAppStore((s) => s.setAllImages);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const activeModel = useAppStore((s) => s.activeModel);
  const favoritesLoaded = useAppStore((s) => s.favoritesLoaded);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const favorites = useAppStore((s) => s.favorites);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);

  // Debounce search query for search modal
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  // Filter change → reset and reload
  useEffect(() => {
    if (!favoritesLoaded && showFavoritesOnly) return;

    const isDefaultFeed =
      !searchQuery.trim() &&
      activeCategory === "all" &&
      activeTimeFilter === "all" &&
      activeModel === "all" &&
      !showFavoritesOnly;

    if (showFavoritesOnly && favorites.length === 0) {
      resetFeed();
      return;
    }

    // If default feed and we already have images cached, use them
    if (isDefaultFeed && useAppStore.getState().allImages.length > 0 && initialLoadRef.current) {
      return;
    }

    resetFeed();
    loadInitialPage();
    initialLoadRef.current = true;
  }, [
    searchQuery,
    activeCategory,
    activeTimeFilter,
    activeModel,
    showFavoritesOnly,
    favoritesLoaded,
    favorites.length,
    resetFeed,
    loadInitialPage,
  ]);

  // Hydrate dimensions for newly loaded images
  useEffect(() => {
    if (allImages.length === 0) return;
    const v = feedVersion;
    hydrateImageDimensions(allImages).then((hydrated) => {
      const current = useAppStore.getState();
      if (current.feedVersion !== v) return;
      const changed = hydrated.some(
        (img, i) =>
          img.width !== allImages[i]?.width ||
          img.height !== allImages[i]?.height
      );
      if (changed) setAllImages(hydrated);
    });
  }, [allImages, feedVersion, setAllImages]);

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
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#f5f2ed]/70 dark:bg-[#0c0b09]/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 select-none">
            <h1
              className="text-xl font-bold tracking-tight text-[#2a2520] dark:text-[#c4bdb4]"
              style={{ fontFamily: "'Caveat', cursive" }}
            >
              Aestara
            </h1>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.15em] text-[#5c564e] dark:text-[#7a7269]">
            <Link
              href="/"
              className="hover:text-[#2a2520] dark:hover:text-[#c4bdb4] transition-colors"
            >
              Gallery
            </Link>
            <Link
              href="/generate"
              className="hover:text-[#2a2520] dark:hover:text-[#c4bdb4] transition-colors"
            >
              Create
            </Link>
            <Link
              href="/history"
              className="hover:text-[#2a2520] dark:hover:text-[#c4bdb4] transition-colors"
            >
              History
            </Link>
          </nav>
          <div className="flex items-center gap-3">
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

      {/* Top spacer for fixed header */}
      <div className="h-14" />

      {/* Main Gallery */}
      <div
        id="gallery"
        className="mx-auto flex max-w-[1400px] scroll-mt-20 gap-12 px-6 py-16 lg:gap-20"
      >
        <aside className="hidden w-[200px] flex-shrink-0 lg:block lg:sticky lg:top-[73px] lg:self-start">
          <MinimalSidebar
            onSearchClick={() => setSearchOpen(true)}
            isLoading={isLoading}
          />
        </aside>
        <main className="min-w-0 flex-1">
          {isLoading && allImages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 gap-6">
              <div className="relative aspect-[3/4] w-56 bg-[#e8e4de] dark:bg-[#141210] overflow-hidden rounded-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
              </div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
                Loading
              </p>
            </div>
          ) : (
            <MasonryGrid
              images={allImages}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
            />
          )}
        </main>
      </div>

      <ImageModal />
      <SearchModal
        open={searchOpen}
        onClose={handleCloseSearch}
        isLoadingResults={
          Boolean(searchQuery) &&
          (isLoading || debouncedSearchQuery !== searchQuery.trim())
        }
      />
      <LoginPrompt />

      {/* Minimal Footer */}
      <footer className="py-16 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
          Aestara — AI Image Generation
        </p>
      </footer>
    </div>
  );
}
