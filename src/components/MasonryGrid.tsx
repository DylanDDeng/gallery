"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ImageCard from "./ImageCard";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface MasonryGridProps {
  images: ImagePrompt[];
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

function getColumnCount(width: number) {
  if (width >= 1280) return 3;
  if (width >= 768) return 2;
  return 1;
}

function estimateHeight(image: ImagePrompt) {
  return image.width && image.height ? image.height / image.width : 4 / 3;
}

function buildColumns(
  images: ImagePrompt[],
  columnCount: number
): ImagePrompt[][] {
  const columns: ImagePrompt[][] = Array.from(
    { length: columnCount },
    () => []
  );
  const heights = Array.from({ length: columnCount }, () => 0);

  for (const image of images) {
    const shortestColumnIndex = heights.indexOf(Math.min(...heights));
    columns[shortestColumnIndex].push(image);
    heights[shortestColumnIndex] += estimateHeight(image) + 0.12;
  }

  return columns;
}

export default function MasonryGrid({
  images,
  hasMore,
  isLoadingMore,
}: MasonryGridProps) {
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const favorites = useAppStore((s) => s.favorites);
  const loadNextPage = useAppStore((s) => s.loadNextPage);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(() =>
    typeof window === "undefined" ? 1 : getColumnCount(window.innerWidth)
  );

  useEffect(() => {
    const handleResize = () => setColumnCount(getColumnCount(window.innerWidth));
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadNextPage();
      },
      { rootMargin: "600px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadNextPage]);

  const filteredImages = useMemo(() => {
    if (!showFavoritesOnly) return images;
    return images.filter((img) => favorites.includes(img.id));
  }, [favorites, images, showFavoritesOnly]);

  const hasActiveFeedFilters =
    Boolean(useAppStore.getState().searchQuery) ||
    useAppStore.getState().activeCategory !== "all" ||
    useAppStore.getState().activeTimeFilter !== "all" ||
    useAppStore.getState().activeModel !== "all";

  const columns = useMemo(
    () => buildColumns(filteredImages, columnCount),
    [filteredImages, columnCount]
  );

  if (filteredImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-[#8a837a] dark:text-[#5c564e]">
        <p className="text-sm tracking-wide">No images found</p>
        <p className="mt-2 text-xs opacity-60">
          {showFavoritesOnly
            ? "Save images to see them here"
            : hasActiveFeedFilters
            ? "Try adjusting your search or filter"
            : "New works will appear here"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div
        className="grid items-start gap-8 lg:gap-12"
        style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
      >
        {columns.map((column, index) => (
          <div key={index} className="flex flex-col gap-8 lg:gap-12">
            {column.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        ))}
      </div>
      {/* Sentinel for IntersectionObserver */}
      <div ref={sentinelRef} className="h-1" />
      {isLoadingMore && (
        <div className="flex items-center justify-center py-16">
          <div className="relative aspect-[3/4] w-40 bg-[#e8e4de] dark:bg-[#141210] overflow-hidden rounded-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>
      )}
      {!hasMore && filteredImages.length > 0 && (
        <p className="py-16 text-center text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
          End of gallery
        </p>
      )}
    </>
  );
}
