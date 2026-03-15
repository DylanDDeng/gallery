"use client";

import { useEffect, useState, useCallback } from "react";
import { MOCK_IMAGES } from "@/lib/constants";
import CategoryFilter from "@/components/CategoryFilter";
import MasonryGrid from "@/components/MasonryGrid";
import ImageModal from "@/components/ImageModal";
import SearchModal from "@/components/SearchModal";
import UserMenu from "@/components/UserMenu";
import LoginPrompt from "@/components/LoginPrompt";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

export default function Home() {
  const [images, setImages] = useState<ImagePrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const setAllImages = useAppStore((s) => s.setAllImages);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);

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
    fetch("/api/images")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setImages(data);
          setAllImages(data);
        } else {
          setImages(MOCK_IMAGES);
          setAllImages(MOCK_IMAGES);
        }
      })
      .catch(() => {
        setImages(MOCK_IMAGES);
        setAllImages(MOCK_IMAGES);
      })
      .finally(() => setIsLoading(false));
  }, [setAllImages]);

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
        <aside className="hidden w-[180px] flex-shrink-0 lg:block lg:sticky lg:top-[73px] lg:self-start">
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
              <MasonryGrid images={images} />
            )}
          </div>
        </main>
      </div>

      <ImageModal />
      <SearchModal open={searchOpen} onClose={handleCloseSearch} />
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
