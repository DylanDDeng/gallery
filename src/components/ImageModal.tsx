"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  buildRemixGenerateUrl,
  readRemixGenerationDraft,
  saveRemixGenerationDraft,
} from "@/lib/generation-draft";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

const PRELOAD_THRESHOLD = 8;

export default function ImageModal() {
  const router = useRouter();
  const selectedImage = useAppStore((s) => s.selectedImage);
  const allImages = useAppStore((s) => s.allImages);
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const user = useAppStore((s) => s.user);
  const setShowLoginPrompt = useAppStore((s) => s.setShowLoginPrompt);
  const hasMore = useAppStore((s) => s.hasMore);
  const isLoadingMore = useAppStore((s) => s.isLoadingMore);
  const loadNextPage = useAppStore((s) => s.loadNextPage);

  const [promptLang, setPromptLang] = useState<"en" | "zh" | "ja">("en");
  const [copied, setCopied] = useState(false);
  const [imageDetailsById, setImageDetailsById] = useState<
    Record<string, ImagePrompt>
  >({});
  const [detailErrorsById, setDetailErrorsById] = useState<
    Record<string, string>
  >({});
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const activeImage = selectedImage
    ? (imageDetailsById[selectedImage.id] ?? selectedImage)
    : null;

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
        setPromptLang("en");
      }
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        const prev =
          allImages[(idx - 1 + allImages.length) % allImages.length];
        setSelectedImage(prev);
        setPromptLang("en");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    if (selectedImage) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedImage, allImages, setSelectedImage]);

  // Auto-preload when near end
  useEffect(() => {
    if (!selectedImage || !hasMore || isLoadingMore) return;
    const idx = allImages.findIndex((img) => img.id === selectedImage.id);
    const remaining = allImages.length - idx - 1;
    if (remaining <= PRELOAD_THRESHOLD) {
      loadNextPage();
    }
  }, [selectedImage, allImages, hasMore, isLoadingMore, loadNextPage]);

  // Fetch details
  useEffect(() => {
    if (
      !selectedImage ||
      imageDetailsById[selectedImage.id] ||
      detailErrorsById[selectedImage.id]
    )
      return;

    setIsLoadingDetails(true);
    fetch(`/api/images/${selectedImage.id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed");
        setImageDetailsById((c) => ({
          ...c,
          [selectedImage.id]: json as ImagePrompt,
        }));
      })
      .catch((err) => {
        setDetailErrorsById((c) => ({ ...c, [selectedImage.id]: err.message }));
      })
      .finally(() => setIsLoadingDetails(false));
  }, [selectedImage, imageDetailsById, detailErrorsById]);

  if (!selectedImage || !activeImage) return null;

  const promptText =
    promptLang === "zh"
      ? activeImage.prompt_zh || activeImage.prompt || ""
      : promptLang === "ja"
      ? activeImage.prompt_ja || activeImage.prompt || ""
      : activeImage.prompt || "";

  const availableLangs: ("en" | "zh" | "ja")[] = ["en"];
  if (activeImage.has_prompt_zh || activeImage.prompt_zh)
    availableLangs.push("zh");
  if (activeImage.has_prompt_ja || activeImage.prompt_ja)
    availableLangs.push("ja");

  const copyPrompt = () => {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(selectedImage.url);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${selectedImage.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      console.error("Download failed");
    }
  };

  const handleOpenRemixStudio = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (!promptText) return;

    const existingDraft = readRemixGenerationDraft();
    const shouldReuseExistingDraft =
      existingDraft?.sourceImageId === activeImage.id &&
      existingDraft.returnImageId === activeImage.id &&
      Boolean(existingDraft.sourceImage?.url) &&
      existingDraft.sourceImage?.url !== activeImage.url;

    saveRemixGenerationDraft(
      shouldReuseExistingDraft
        ? {
            ...existingDraft,
            createdAt: Date.now(),
            returnTo: "gallery",
            returnImageId: activeImage.id,
          }
        : {
            mode: "remix",
            sourceImageId: activeImage.id,
            prompt: promptText,
            promptLang,
            sourceImage: activeImage,
            returnTo: "gallery",
            returnImageId: activeImage.id,
            createdAt: Date.now(),
          }
    );

    setSelectedImage(null);
    router.push(
      buildRemixGenerateUrl({
        sourceImageId: activeImage.id,
        sourceImageUrl: activeImage.url,
        sourcePrompt: promptText,
        sourceAuthor: activeImage.author,
        sourceModel: activeImage.model,
        sourceCategory: activeImage.category,
        returnTo: "gallery",
        returnImageId: activeImage.id,
      })
    );
  };

  const idx = allImages.findIndex((img) => img.id === selectedImage.id);
  const goNext = () => {
    setSelectedImage(allImages[(idx + 1) % allImages.length]);
    setPromptLang("en");
  };
  const goPrev = () => {
    setSelectedImage(
      allImages[(idx - 1 + allImages.length) % allImages.length]
    );
    setPromptLang("en");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#f5f2ed]"
      onClick={() => setSelectedImage(null)}
    >
      {/* Top toolbar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 py-3 md:px-8 md:py-4 border-b border-[#d5cfc4]/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setSelectedImage(null)}
          className="text-[#8a837a] hover:text-[#2a2520] transition-colors duration-300"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase tracking-[0.2em] text-[#a39b90]/60">
            {String(idx + 1).padStart(2, "0")} /{" "}
            {String(allImages.length).padStart(2, "0")}
            {hasMore && "+"}
          </span>
          <button
            onClick={handleDownload}
            className="text-[#8a837a] hover:text-[#2a2520] transition-colors duration-300"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
          <button
            onClick={() => toggleFavorite(selectedImage.id)}
            className={`transition-colors duration-300 ${
              isFavorite(selectedImage.id)
                ? "text-red-400"
                : "text-[#8a837a] hover:text-[#2a2520]"
            }`}
          >
            <svg
              className="h-4 w-4"
              fill={isFavorite(selectedImage.id) ? "currentColor" : "none"}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Image */}
        <div
          className="relative flex-1 min-h-0 bg-[#ebe7e0] flex items-center justify-center px-4 py-6 md:px-10 md:py-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Prev arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="absolute left-0 top-0 bottom-0 w-16 md:w-24 flex items-center justify-center text-[#d5cfc4] hover:text-[#8a837a]/60 transition-all duration-500 group z-10"
          >
            <svg
              className="h-6 w-6 transform -translate-x-1 group-hover:translate-x-0 transition-transform duration-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Next arrow */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="absolute right-0 top-0 bottom-0 w-16 md:w-24 flex items-center justify-center text-[#d5cfc4] hover:text-[#8a837a]/60 transition-all duration-500 group z-10"
          >
            <svg
              className="h-6 w-6 transform translate-x-1 group-hover:translate-x-0 transition-transform duration-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <div className="relative w-full h-full max-w-[900px]">
            <Image
              src={activeImage.url}
              alt=""
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 60vw"
              priority
            />
          </div>
        </div>

        {/* Right: Editorial panel */}
        <div
          className="flex-shrink-0 w-full md:w-[400px] lg:w-[460px] bg-[#f5f2ed] border-t md:border-t-0 md:border-l border-[#d5cfc4]/40 flex flex-col relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Magazine masthead */}
          <div className="px-8 pt-8 md:px-12 md:pt-12 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-[0.35em] text-[#a39b90]">
                Aestara Archive
              </span>
              <span className="text-[9px] uppercase tracking-[0.2em] text-[#a39b90]">
                {new Date(activeImage.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-6 md:px-12 md:py-10 scrollbar-hide">
            {/* Large decorative page number */}
            <div className="mb-10 relative">
              <span
                className="text-[80px] md:text-[100px] leading-none text-[#e0d9ce] select-none absolute -top-4 -left-2 md:-left-4"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <div className="relative pt-16 md:pt-20">
                <p
                  className="text-[36px] md:text-[48px] leading-[1.05] italic text-[#2a2520]/90"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  {activeImage.category || "Untitled"}
                </p>
                <div className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-[#8a837a]/70">
                  <span>{activeImage.author}</span>
                  <span className="text-[#d5cfc4]">—</span>
                  <span>{activeImage.model}</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-[#d5cfc4]/60 mb-10" />

            {/* Prompt section */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <span className="text-[9px] uppercase tracking-[0.35em] text-[#a39b90]">
                  Generation Notes
                </span>
                {availableLangs.length > 1 && (
                  <div className="flex items-center gap-1">
                    {availableLangs.map((lang) => (
                      <button
                        key={lang}
                        onClick={() => setPromptLang(lang)}
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 transition-colors ${
                          promptLang === lang
                            ? "text-[#5c564e] border-b border-[#5c564e]/30"
                            : "text-[#a39b90] hover:text-[#8a837a]"
                        }`}
                      >
                        {{ en: "EN", zh: "中", ja: "日" }[lang]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mb-4">
                {isLoadingDetails ? (
                  <p className="text-[12px] leading-[1.9] text-[#a39b90]">
                    Loading prompt details...
                  </p>
                ) : detailErrorsById[selectedImage.id] ? (
                  <p className="text-[12px] leading-[1.9] text-red-400/60">
                    {detailErrorsById[selectedImage.id]}
                  </p>
                ) : promptText ? (
                  <div className="relative">
                    <span
                      className="absolute -top-2 -left-1 text-[40px] leading-none text-[#d5cfc4]/60 select-none"
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                    >
                      &ldquo;
                    </span>
                    <p className="text-[12px] leading-[2] text-[#5c564e]/80 whitespace-pre-wrap font-light pl-4">
                      {promptText}
                    </p>
                  </div>
                ) : (
                  <p className="text-[12px] leading-[1.9] text-[#a39b90]">
                    No prompt available.
                  </p>
                )}
              </div>

              {promptText && (
                <button
                  onClick={copyPrompt}
                  className="text-[9px] uppercase tracking-[0.25em] text-[#a39b90] hover:text-[#5c564e] transition-colors duration-300 pl-4"
                >
                  {copied ? "Copied" : "Copy Text"}
                </button>
              )}
            </div>

            {/* Tags */}
            {activeImage.tags.length > 0 && (
              <div className="mb-10">
                <div className="h-px bg-[#d5cfc4]/60 mb-5" />
                <p className="text-[9px] uppercase tracking-[0.35em] text-[#a39b90] mb-4">
                  Index
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {activeImage.tags.map((tag, i) => (
                    <span
                      key={tag}
                      className="text-[11px] text-[#8a837a]/50 lowercase tracking-wide"
                    >
                      {tag}
                      {i < activeImage.tags.length - 1 && (
                        <span className="text-[#d5cfc4] ml-5">·</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex-shrink-0 border-t border-[#d5cfc4]/40 px-8 py-4 md:px-12 md:py-6 flex items-center justify-between">
            <button
              onClick={handleOpenRemixStudio}
              disabled={!promptText || isLoadingDetails}
              className="text-[10px] uppercase tracking-[0.2em] text-[#8a837a]/50 hover:text-[#5c564e]/80 transition-colors duration-300 disabled:opacity-30"
            >
              Remix
            </button>
            <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.2em] text-[#a39b90]">
              <span>{activeImage.width || "—"}</span>
              <span className="text-[#d5cfc4]">×</span>
              <span>{activeImage.height || "—"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
