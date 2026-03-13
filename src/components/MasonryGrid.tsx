"use client";

import { useMemo } from "react";
import ImageCard from "./ImageCard";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface MasonryGridProps {
  images: ImagePrompt[];
}

export default function MasonryGrid({ images }: MasonryGridProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const activeCategory = useAppStore((s) => s.activeCategory);
  const showFavoritesOnly = useAppStore((s) => s.showFavoritesOnly);
  const favorites = useAppStore((s) => s.favorites);

  const filteredImages = useMemo(() => {
    let result = images;

    if (activeCategory !== "all") {
      result = result.filter((img) => img.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((img) => {
        const prompt = img.prompt.toLowerCase();
        const tags = img.tags.join(" ").toLowerCase();
        const author = img.author.toLowerCase();
        const model = img.model.toLowerCase();
        return (
          prompt.includes(query) ||
          tags.includes(query) ||
          author.includes(query) ||
          model.includes(query)
        );
      });
    }

    if (showFavoritesOnly) {
      result = result.filter((img) => favorites.includes(img.id));
    }

    return result;
  }, [images, searchQuery, activeCategory, showFavoritesOnly, favorites]);

  if (filteredImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-zinc-500">
        <svg className="mb-4 h-14 w-14 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-sm font-medium text-zinc-400">No images found</p>
        <p className="mt-1 text-xs text-zinc-600">Try adjusting your search or filter</p>
      </div>
    );
  }

  return (
    <div className="columns-1 gap-3 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5">
      {filteredImages.map((image) => (
        <ImageCard key={image.id} image={image} />
      ))}
    </div>
  );
}
