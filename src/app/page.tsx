"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MOCK_IMAGES } from "@/lib/constants";
import CategoryFilter from "@/components/CategoryFilter";
import MasonryGrid from "@/components/MasonryGrid";
import ImageModal from "@/components/ImageModal";
import SearchModal from "@/components/SearchModal";
import UserMenu from "@/components/UserMenu";
import LoginPrompt from "@/components/LoginPrompt";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

const PAGE_SIZE = 20;

export default function Home() {
  const [images, setImages] = useState<ImagePrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<ImagePrompt[]>([]);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  const initialLoadRef = useRef(true);
  const feedVersionRef = useRef(0);
  const setAllImages = useAppStore((s) => s.setAllImages);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const activeModel = useAppStore((s) => s.activeModel);
  const favorites = useAppStore((s) => s.favorites);
  const favoritesLoaded = useAppStore((s) => s.favoritesLoaded);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const favoriteIdsParam = showFavoritesOnly ? favorites.join(",") : "";
  const hasFavoriteSelection = favoriteIdsParam.length > 0;

  // Keep refs in sync with state
  imagesRef.current = images;
  hasMoreRef.current = hasMore;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);
    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  const buildQueryString = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });

      if (debouncedSearchQuery) {
        params.set("search", debouncedSearchQuery);
      }

      if (activeCategory !== "all") {
        params.set("category", activeCategory);
      }

      if (activeTimeFilter !== "all") {
        params.set("time", activeTimeFilter);
      }

      if (activeModel !== "all") {
        params.set("model", activeModel);
      }

      if (favoriteIdsParam) {
        params.set("ids", favoriteIdsParam);
      }

      return params.toString();
    },
    [
      activeCategory,
      activeModel,
      activeTimeFilter,
      debouncedSearchQuery,
      favoriteIdsParam,
    ]
  );

  const fetchPage = useCallback(
    async (offset: number, signal?: AbortSignal) => {
      const res = await fetch(`/api/images?${buildQueryString(offset)}`, signal ? { signal } : undefined);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load images");
      }

      return {
        data: (json.data ?? []) as ImagePrompt[],
        hasMore: Boolean(json.hasMore),
      };
    },
    [buildQueryString]
  );

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || isLoading) return;
    if (showFavoritesOnly && (!favoritesLoaded || !hasFavoriteSelection)) return;

    const feedVersion = feedVersionRef.current;
    loadingRef.current = true;
    setIsLoadingMore(true);

    try {
      const { data, hasMore: more } = await fetchPage(imagesRef.current.length);

      if (feedVersion !== feedVersionRef.current) return;

      const accumulated = [...imagesRef.current, ...data];
      imagesRef.current = accumulated;
      setImages(accumulated);
      setAllImages(accumulated);
      setHasMore(more);
    } catch {
      // silently fail — user still sees what was loaded
    } finally {
      if (feedVersion === feedVersionRef.current) {
        loadingRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [
    hasFavoriteSelection,
    favoritesLoaded,
    fetchPage,
    isLoading,
    setAllImages,
    showFavoritesOnly,
  ]);

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

  // Close search but keep the query active
  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);

  useEffect(() => {
    const isDefaultFeed =
      !debouncedSearchQuery &&
      activeCategory === "all" &&
      activeTimeFilter === "all" &&
      activeModel === "all" &&
      !showFavoritesOnly;

    if (showFavoritesOnly && !favoritesLoaded) {
      setIsLoading(true);
      return;
    }

    if (showFavoritesOnly && !hasFavoriteSelection) {
      feedVersionRef.current += 1;
      imagesRef.current = [];
      loadingRef.current = false;
      setImages([]);
      setAllImages([]);
      setHasMore(false);
      setIsLoading(false);
      setIsLoadingMore(false);
      initialLoadRef.current = false;
      return;
    }

    const controller = new AbortController();
    const feedVersion = feedVersionRef.current + 1;
    feedVersionRef.current = feedVersion;
    loadingRef.current = false;
    setIsLoading(true);
    setIsLoadingMore(false);
    setHasMore(false);
    imagesRef.current = [];
    setImages([]);
    setAllImages([]);

    if (!initialLoadRef.current) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    fetchPage(0, controller.signal)
      .then(({ data, hasMore: more }) => {
        if (feedVersion !== feedVersionRef.current) return;

        if (data.length > 0 || !isDefaultFeed) {
          imagesRef.current = data;
          setImages(data);
          setAllImages(data);
          setHasMore(more);
          return;
        }

        imagesRef.current = MOCK_IMAGES;
        setImages(MOCK_IMAGES);
        setAllImages(MOCK_IMAGES);
        setHasMore(false);
      })
      .catch(() => {
        if (controller.signal.aborted || feedVersion !== feedVersionRef.current) return;

        if (isDefaultFeed) {
          imagesRef.current = MOCK_IMAGES;
          setImages(MOCK_IMAGES);
          setAllImages(MOCK_IMAGES);
        } else {
          imagesRef.current = [];
          setImages([]);
          setAllImages([]);
        }
        setHasMore(false);
      })
      .finally(() => {
        if (feedVersion !== feedVersionRef.current) return;

        setIsLoading(false);
        initialLoadRef.current = false;
      });

    return () => controller.abort();
  }, [
    activeCategory,
    activeModel,
    activeTimeFilter,
    debouncedSearchQuery,
    hasFavoriteSelection,
    favoritesLoaded,
    fetchPage,
    setAllImages,
    showFavoritesOnly,
  ]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, isLoading]); // re-run when isLoading flips so sentinel ref is available

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <div className="flex select-none items-center gap-3">
            <img src="/logo.png" alt="" className="h-8 w-8" />
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100" style={{ fontFamily: "'Caveat', cursive" }}>
              Aestara
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <UserMenu />
            <button
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {theme === "light" ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto flex max-w-[1600px] gap-6 px-6 py-6">
        <aside className="hidden w-[220px] flex-shrink-0 lg:block lg:sticky lg:top-[73px] lg:self-start">
          <div className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 p-3">
            <button
              onClick={() => setSearchOpen(true)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-all ${
                searchQuery
                  ? "bg-zinc-900 text-white dark:bg-white/10 dark:text-white"
                  : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/5 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
              {searchQuery && (
                <span className="ml-auto truncate max-w-[60px] text-[11px] opacity-70">{searchQuery}</span>
              )}
            </button>
            <CategoryFilter />
          </div>
        </aside>
        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-400" />
              </div>
            ) : (
              <MasonryGrid
                images={images}
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                sentinelRef={sentinelRef}
              />
            )}
          </div>
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

      {/* Footer */}
      <footer className="border-t border-zinc-100 dark:border-zinc-900 py-6 text-center text-xs text-zinc-400">
        <a href="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
