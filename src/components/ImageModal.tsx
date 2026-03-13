"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useAppStore } from "@/store";

export default function ImageModal() {
  const selectedImage = useAppStore((s) => s.selectedImage);
  const allImages = useAppStore((s) => s.allImages);
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedImage) return;
      const idx = allImages.findIndex((img) => img.id === selectedImage.id);
      if (e.key === "Escape") setSelectedImage(null);
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault();
        const next = allImages[(idx + 1) % allImages.length];
        setSelectedImage(next);
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = allImages[(idx - 1 + allImages.length) % allImages.length];
        setSelectedImage(prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    if (selectedImage) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedImage, allImages, setSelectedImage]);

  // Auto-scroll thumbnail into view
  useEffect(() => {
    if (thumbnailRef.current && selectedImage) {
      const activeThumb = thumbnailRef.current.querySelector(
        `[data-thumb-id="${selectedImage.id}"]`
      );
      activeThumb?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedImage]);

  if (!selectedImage) return null;

  const copyPrompt = () => {
    navigator.clipboard.writeText(selectedImage.prompt);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={() => setSelectedImage(null)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xl" />

      {/* Modal */}
      <div
        className="relative z-10 flex h-[95vh] w-full max-w-[1400px] overflow-hidden rounded-2xl bg-white dark:bg-zinc-950 ring-1 ring-zinc-200 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: Large image */}
        <div className="relative flex-1 flex items-center justify-center overflow-auto p-6 bg-zinc-50 dark:bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage.url}
            alt="AI generated image"
            className="max-w-[95%] max-h-[95%] rounded-2xl shadow-2xl"
          />
        </div>

        {/* Right: Details panel */}
        <div className="flex w-[380px] flex-shrink-0 flex-col overflow-hidden border-l border-zinc-200 dark:border-white/5">
          {/* Details scrollable area */}
          <div className="flex-1 overflow-y-auto p-5">
            {/* Close button */}
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                Prompt Details
              </span>
              <button
                onClick={() => setSelectedImage(null)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Meta info */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-white/5">
                {selectedImage.model}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">by {selectedImage.author}</span>
            </div>

            {/* Tags */}
            {selectedImage.tags.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-1.5">
                {selectedImage.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Prompt */}
            <div className="mb-4">
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Prompt
              </h3>
              <div className="scrollbar-hide group/prompt max-h-[70vh] overflow-y-auto rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-4 ring-1 ring-zinc-200 dark:ring-white/5">
                <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                  {selectedImage.prompt}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex-shrink-0 border-t border-zinc-200 dark:border-white/5 p-4">
            <div className="flex gap-2">
              <button
                onClick={copyPrompt}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-white py-2.5 text-sm font-semibold text-white dark:text-zinc-900 transition-all hover:bg-zinc-700 dark:hover:bg-zinc-200"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy
              </button>
              <button
                onClick={() => toggleFavorite(selectedImage.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                  isFavorite(selectedImage.id)
                    ? "bg-red-500/15 text-red-500 dark:text-red-400 ring-1 ring-red-500/30 hover:bg-red-500/25"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 ring-1 ring-zinc-200 dark:ring-white/5 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-700 dark:hover:text-zinc-200"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill={isFavorite(selectedImage.id) ? "currentColor" : "none"}
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
          </div>
        </div>

        {/* Far right: Vertical thumbnail strip */}
        <div ref={thumbnailRef} className="flex w-[72px] flex-shrink-0 flex-col items-center gap-1.5 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50 py-3 px-1.5">
          {allImages.map((img) => {
            const isActive = img.id === selectedImage.id;
            return (
              <button
                key={img.id}
                data-thumb-id={img.id}
                onClick={() => setSelectedImage(img)}
                className={`relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg transition-all duration-300 ${
                  isActive
                    ? "ring-2 ring-zinc-900 dark:ring-white/80 scale-105"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                <Image
                  src={img.url}
                  alt=""
                  width={60}
                  height={60}
                  className={`h-full w-full object-cover ${
                    isActive ? "" : "blur-[2px]"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
