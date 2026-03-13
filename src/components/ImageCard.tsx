"use client";

import { useState } from "react";
import Image from "next/image";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface ImageCardProps {
  image: ImagePrompt;
}

export default function ImageCard({ image }: ImageCardProps) {
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);

  const summary = image.author || image.model || "AI Generated Image";

  const handleLoad = (
    e: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
  };

  const style: React.CSSProperties = aspectRatio
    ? { aspectRatio: String(aspectRatio) }
    : image.width && image.height
    ? { aspectRatio: `${image.width} / ${image.height}` }
    : { aspectRatio: "3 / 4" };

  return (
    <div className="group relative mb-3 break-inside-avoid">
      <div
        className="relative cursor-pointer overflow-hidden rounded-xl bg-zinc-800 ring-1 ring-white/5"
        style={style}
        onClick={() => setSelectedImage(image)}
      >
        <Image
          src={image.url}
          alt={summary}
          width={image.width || 768}
          height={image.height || 1024}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03] group-hover:brightness-110"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          onLoad={handleLoad}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="text-[13px] font-medium text-white truncate">
              {summary}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                {image.model}
              </span>
              <span className="text-[11px] text-white/60">{image.author}</span>
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(image.id);
        }}
        className={`absolute top-2 right-2 rounded-full p-1.5 transition-all duration-200 ${
          isFavorite(image.id)
            ? "bg-red-500/90 text-white shadow-lg shadow-red-500/20"
            : "bg-black/40 text-white/70 opacity-0 backdrop-blur-sm group-hover:opacity-100 hover:text-white"
        }`}
      >
        <svg
          className="h-3.5 w-3.5"
          fill={isFavorite(image.id) ? "currentColor" : "none"}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      </button>
    </div>
  );
}
