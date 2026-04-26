"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface ImageCardProps {
  image: ImagePrompt;
}

function ImageCard({ image }: ImageCardProps) {
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const [aspectRatio, setAspectRatio] = useState<number | null>(
    image.width && image.height ? image.width / image.height : null
  );
  const [isDecoded, setIsDecoded] = useState(false);

  const summary = image.model || "AI Generated Image";

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    if (!aspectRatio && img.naturalWidth && img.naturalHeight) {
      setAspectRatio(img.naturalWidth / img.naturalHeight);
    }
    setIsDecoded(true);
  };

  const handleError = () => {
    setIsDecoded(true);
  };

  const style: React.CSSProperties = aspectRatio
    ? { aspectRatio: String(aspectRatio) }
    : image.width && image.height
    ? { aspectRatio: `${image.width} / ${image.height}` }
    : { aspectRatio: "3 / 4" };

  return (
    <div className="group">
      {/* Image frame — like a gallery print with subtle border */}
      <div
        className="relative cursor-pointer overflow-hidden bg-[#e8e4de] dark:bg-[#141210] shadow-[0_2px_12px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] transition-all duration-700 group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)] dark:group-hover:shadow-[0_4px_24px_rgba(0,0,0,0.5)]"
        style={style}
        onClick={() => setSelectedImage(image)}
      >
        <Image
          src={image.url}
          alt={summary}
          width={image.width || 768}
          height={image.height || 1024}
          className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-[1.02] group-hover:brightness-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          priority={false}
          onLoad={handleLoad}
          onError={handleError}
        />
        <div
          className={`pointer-events-none absolute inset-0 bg-[#e8e4de] dark:bg-[#141210] transition-opacity duration-500 ${
            isDecoded ? "opacity-0" : "opacity-100"
          }`}
        />

        {/* Favorite — minimal, only on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(image.id);
          }}
          className={`absolute top-4 right-4 rounded-full p-2 transition-all duration-300 backdrop-blur-sm ${
            isFavorite(image.id)
              ? "bg-[#f5f2ed]/80 text-red-500 shadow-sm"
              : "bg-black/10 text-[#f5f2ed]/40 opacity-0 group-hover:opacity-100 hover:bg-black/20 hover:text-[#f5f2ed]/70"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill={isFavorite(image.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Caption below — editorial style */}
      <div className="mt-5 text-center">
        <p
          className="text-[14px] italic text-[#2a2520] dark:text-[#c4bdb4] tracking-wide"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {image.category || "Untitled"}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#8a837a] dark:text-[#5c564e]">
          {image.author} — {image.model}
        </p>
      </div>
    </div>
  );
}

export default memo(ImageCard);
