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
  const [loaded, setLoaded] = useState(false);

  const summary = image.model || "AI Generated Image";

  const modelLogo = (() => {
    const m = image.model.toLowerCase();
    if (m.includes("z image")) return "/alibaba-color.svg";
    if (m.includes("seedream")) return "/bytedance-color.svg";
    if (m.includes("gpt")) return "/openai-color.svg";
    return "/nanobanana-color.svg";
  })();

  const handleLoad = (
    e: React.SyntheticEvent<HTMLImageElement, Event>
  ) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
    setLoaded(true);
  };

  const style: React.CSSProperties = aspectRatio
    ? { aspectRatio: String(aspectRatio) }
    : image.width && image.height
    ? { aspectRatio: `${image.width} / ${image.height}` }
    : { aspectRatio: "3 / 4" };

  return (
    <div className="group relative mb-3 break-inside-avoid">
      <div
        className="relative cursor-pointer overflow-hidden bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-200 dark:ring-white/5"
        style={style}
        onClick={() => setSelectedImage(image)}
      >
        <Image
          src={image.url}
          alt={summary}
          width={image.width || 768}
          height={image.height || 1024}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-[1.03] group-hover:brightness-110 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          onLoad={handleLoad}
        />
        {!loaded && (
          <div className="absolute inset-0 animate-pulse bg-zinc-100 dark:bg-zinc-800">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-400 dark:border-t-zinc-400" />
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                <img src={modelLogo} alt="" className="h-3.5 w-3.5" />
                {image.model}
              </span>
              {image.author && (
                <a
                  href={image.tweet_url || `https://x.com/${image.author.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] text-white/60 transition-colors hover:text-white"
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  {image.author}
                </a>
              )}
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
