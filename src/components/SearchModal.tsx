"use client";

import { useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  isLoadingResults: boolean;
}

export default function SearchModal({ open, onClose, isLoadingResults }: SearchModalProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const allImages = useAppStore((s) => s.allImages);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    if (!searchQuery) return [];
    return allImages.slice(0, 12);
  }, [allImages, searchQuery]);

  const handleSelectImage = (image: ImagePrompt) => {
    onClose();
    setSearchQuery("");
    setTimeout(() => setSelectedImage(image), 100);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh]">
      <div
        className="absolute inset-0 bg-[#0c0b09]/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Search input */}
        <div className="flex items-center gap-3 rounded-t-2xl border border-b-0 border-[#d5cfc4] dark:border-[#2a2520] bg-[#f5f2ed] dark:bg-[#141210] px-5 py-3.5 shadow-2xl">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[#8a837a]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search prompts, tags, authors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#141210] dark:text-[#e0d9ce] placeholder-[#8a837a] dark:placeholder-[#5c564e] outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-[#8a837a] hover:text-[#4a443c] dark:hover:text-[#a39b90]"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded-md border border-[#d5cfc4] dark:border-[#2a2520] bg-[#ebe7e0] dark:bg-[#1a1814] px-1.5 py-0.5 text-[10px] font-medium text-[#8a837a]">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto rounded-b-2xl border border-[#d5cfc4] dark:border-[#2a2520] bg-[#f5f2ed] dark:bg-[#141210] shadow-2xl">
          {searchQuery && isLoadingResults && (
            <div className="flex flex-col items-center justify-center py-12 text-[#8a837a]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d5cfc4] dark:border-[#2a2520] border-t-[#8a837a]" />
              <p className="mt-3 text-sm">Searching...</p>
            </div>
          )}

          {searchQuery && !isLoadingResults && results.length > 0 && (
            <div className="grid grid-cols-3 gap-2 p-4">
              {results.map((image) => (
                <div
                  key={image.id}
                  onClick={() => handleSelectImage(image)}
                  className="group relative cursor-pointer overflow-hidden rounded-lg bg-[#e0d9ce] dark:bg-[#1a1814] ring-1 ring-[#d5cfc4] dark:ring-white/5"
                  style={{
                    aspectRatio: image.width && image.height
                      ? `${image.width} / ${image.height}`
                      : "3 / 4",
                  }}
                >
                  <Image
                    src={image.url}
                    alt=""
                    width={image.width || 300}
                    height={image.height || 400}
                    className="h-full w-full object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-110"
                    sizes="200px"
                    unoptimized
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}

          {searchQuery && !isLoadingResults && results.length === 0 && (
            <div className="flex flex-col items-center py-12 text-[#8a837a]">
              <svg className="mb-3 h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No results found</p>
            </div>
          )}

          {!searchQuery && (
            <p className="py-8 text-center text-sm text-[#8a837a]">
              Type to search images...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
