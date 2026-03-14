"use client";

import { useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SearchModal({ open, onClose }: SearchModalProps) {
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
    const q = searchQuery.toLowerCase();
    return allImages.filter((img) => {
      const prompt = img.prompt.toLowerCase();
      const tags = img.tags.join(" ").toLowerCase();
      const author = img.author.toLowerCase();
      const model = img.model.toLowerCase();
      return (
        prompt.includes(q) ||
        tags.includes(q) ||
        author.includes(q) ||
        model.includes(q)
      );
    }).slice(0, 12);
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
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
        {/* Search input */}
        <div className="flex items-center gap-3 rounded-t-2xl border border-b-0 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3.5 shadow-2xl">
          <svg
            className="h-5 w-5 flex-shrink-0 text-zinc-400"
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
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto rounded-b-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl">
          {searchQuery && results.length > 0 && (
            <div className="grid grid-cols-3 gap-2 p-4">
              {results.map((image) => (
                <div
                  key={image.id}
                  onClick={() => handleSelectImage(image)}
                  className="group relative cursor-pointer overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-white/5"
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
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}

          {searchQuery && results.length === 0 && (
            <div className="flex flex-col items-center py-12 text-zinc-400">
              <svg className="mb-3 h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm">No results found</p>
            </div>
          )}

          {!searchQuery && (
            <p className="py-8 text-center text-sm text-zinc-400">
              Type to search images...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
