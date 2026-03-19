"use client";

import { RefObject, useMemo } from "react";
import ImageCard from "./ImageCard";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface MasonryGridProps {
  images: ImagePrompt[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
  sentinelRef?: RefObject<HTMLDivElement | null>;
}

export default function MasonryGrid({ images, hasMore, isLoadingMore, sentinelRef }: MasonryGridProps) {
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const favorites = useAppStore((s) => s.favorites);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const activeTimeFilter = useAppStore((s) => s.activeTimeFilter);
  const activeModel = useAppStore((s) => s.activeModel);

  const filteredImages = useMemo(() => {
    if (!showFavoritesOnly) {
      return images;
    }

    return images.filter((img) => favorites.includes(img.id));
  }, [favorites, images, showFavoritesOnly]);

  const hasActiveFeedFilters =
    Boolean(searchQuery) ||
    activeCategory !== "all" ||
    activeTimeFilter !== "all" ||
    activeModel !== "all";

  if (filteredImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
        <svg className="mb-4 h-14 w-14 text-zinc-300 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {showFavoritesOnly ? (
          <>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
              No favorites yet
            </p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
              Click the heart icon on any image to save it here
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">No images found</p>
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
              {hasActiveFeedFilters ? "Try adjusting your search or filter" : "New images will appear here once the gallery is populated"}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
        {filteredImages.map((image) => (
          <div key={image.id} className="mb-3 break-inside-avoid">
            <ImageCard image={image} />
          </div>
        ))}
      </div>
      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" />
      {isLoadingMore && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 dark:border-zinc-700 border-t-zinc-400" />
        </div>
      )}
      {!hasMore && filteredImages.length > 0 && (
        <p className="py-6 text-center text-xs text-zinc-400 dark:text-zinc-600">
          All images loaded
        </p>
      )}
    </>
  );
}
