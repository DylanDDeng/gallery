"use client";

import { memo, useState, useRef, useEffect } from "react";
import Image from "next/image";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface ImageBlockProps {
  image: ImagePrompt;
  index: number;
}

function ImageBlock({ image, index }: ImageBlockProps) {
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const ratio =
    image.width && image.height
      ? image.width / image.height
      : 3 / 4;

  // Tall images fill more of the viewport; wide images fit width
  const isWide = ratio > 1.3;
  const containerStyle: React.CSSProperties = isWide
    ? { maxWidth: "92vw", aspectRatio: `${ratio}` }
    : { height: "min(88vh, 92vw)", aspectRatio: `${ratio}` };

  return (
    <div
      ref={ref}
      className={`flex flex-col items-center transition-all duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}
    >
      {/* Image container — framed like a gallery print */}
      <div
        className="relative cursor-pointer overflow-hidden bg-[#e8e4de] dark:bg-[#141210] shadow-[0_4px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
        style={containerStyle}
        onClick={() => setSelectedImage(image)}
      >
        <Image
          src={image.url}
          alt=""
          fill
          className={`object-cover transition-opacity duration-[1200ms] ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          sizes="90vw"
          priority={index < 3}
          onLoad={() => setIsLoaded(true)}
        />
        {/* Skeleton placeholder while loading */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-[#e8e4de] dark:bg-[#141210] animate-pulse" />
        )}

        {/* Favorite button — minimal, only shows on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(image.id);
          }}
          className={`absolute top-4 right-4 rounded-full p-2.5 transition-all duration-300 backdrop-blur-sm ${
            isFavorite(image.id)
              ? "bg-white/80 text-red-500 shadow-sm"
              : "bg-black/10 text-white/40 opacity-0 hover:opacity-100 hover:bg-black/20 hover:text-white/70"
          }`}
        >
          <svg className="h-4 w-4" fill={isFavorite(image.id) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
      </div>

      {/* Editorial caption */}
      <div className="mt-7 text-center">
        <p
          className="text-[15px] italic text-[#2a2520] dark:text-[#c4bdb4] tracking-wide"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {image.category || "Untitled"}
        </p>
        <p className="mt-1.5 text-[10px] uppercase tracking-[0.2em] text-[#8a837a] dark:text-[#5c564e]">
          {image.author} — {image.model}
        </p>
      </div>
    </div>
  );
}

const MemoImageBlock = memo(ImageBlock);

interface VerticalGalleryProps {
  images: ImagePrompt[];
  hasMore: boolean;
  isLoadingMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

export default function VerticalGallery({
  images,
  hasMore,
  isLoadingMore,
  sentinelRef,
}: VerticalGalleryProps) {
  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-[#8a837a] dark:text-[#5c564e]">
        <p className="text-sm tracking-wide">No images found</p>
        <p className="mt-2 text-xs opacity-60">
          New works will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {images.map((image, i) => (
        <div
          key={image.id}
          className="py-16 md:py-24 lg:py-28 w-full flex justify-center"
        >
          <MemoImageBlock image={image} index={i} />
        </div>
      ))}

      {/* Sentinel */}
      <div ref={sentinelRef} className="h-1 w-full" />

      {/* Loading state — minimal, not a spinner */}
      {isLoadingMore && (
        <div className="py-20 w-full flex justify-center">
          <div className="relative aspect-[3/4] w-48 bg-[#e8e4de] dark:bg-[#141210] overflow-hidden rounded-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>
      )}

      {!hasMore && images.length > 0 && (
        <p className="py-20 text-center text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
          End of gallery
        </p>
      )}
    </div>
  );
}
