"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  buildRemixGenerateUrl,
  readRemixGenerationDraft,
  saveRemixGenerationDraft,
} from "@/lib/generation-draft";
import { useAppStore } from "@/store";

export default function ImageModal() {
  const router = useRouter();
  const selectedImage = useAppStore((s) => s.selectedImage);
  const allImages = useAppStore((s) => s.allImages);
  const setSelectedImage = useAppStore((s) => s.setSelectedImage);
  const toggleFavorite = useAppStore((s) => s.toggleFavorite);
  const isFavorite = useAppStore((s) => s.isFavorite);
  const user = useAppStore((s) => s.user);
  const setShowLoginPrompt = useAppStore((s) => s.setShowLoginPrompt);
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const [promptLang, setPromptLang] = useState<"en" | "zh" | "ja">("en");
  const [copied, setCopied] = useState(false);

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
        const prev = allImages[(idx - 1 + allImages.length) % allImages.length];
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

  const availableLangs: ("en" | "zh" | "ja")[] = ["en"];
  if (selectedImage.prompt_zh) availableLangs.push("zh");
  if (selectedImage.prompt_ja) availableLangs.push("ja");

  const promptText =
    promptLang === "zh"
      ? selectedImage.prompt_zh!
      : promptLang === "ja"
      ? selectedImage.prompt_ja!
      : selectedImage.prompt;

  const modelLogo = (() => {
    const m = selectedImage.model.toLowerCase();
    if (m.includes("z image")) return "/alibaba-color.svg";
    if (m.includes("seedream")) return "/bytedance-color.svg";
    if (m.includes("grok")) return "/grok-color.svg";
    if (m.includes("gpt")) return "/openai-color.svg";
    return "/nanobanana-color.svg";
  })();

  const copyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(selectedImage.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `image-${selectedImage.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  const handleOpenRemixStudio = async () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    const existingDraft = readRemixGenerationDraft();
    const shouldReuseExistingDraft =
      existingDraft?.sourceImageId === selectedImage.id &&
      existingDraft.returnImageId === selectedImage.id &&
      Boolean(existingDraft.sourceImage?.url) &&
      existingDraft.sourceImage?.url !== selectedImage.url;

    saveRemixGenerationDraft(
      shouldReuseExistingDraft
        ? {
            ...existingDraft,
            createdAt: Date.now(),
            returnTo: "gallery",
            returnImageId: selectedImage.id,
          }
        : {
            mode: "remix",
            sourceImageId: selectedImage.id,
            prompt: promptText,
            promptLang,
            sourceImage: selectedImage,
            returnTo: "gallery",
            returnImageId: selectedImage.id,
            createdAt: Date.now(),
          }
    );

    setSelectedImage(null);
    router.push(
      buildRemixGenerateUrl({
        sourceImageId: selectedImage.id,
        sourceImageUrl: selectedImage.url,
        sourcePrompt: promptText,
        sourceAuthor: selectedImage.author,
        sourceModel: selectedImage.model,
        sourceCategory: selectedImage.category,
        returnTo: "gallery",
        returnImageId: selectedImage.id,
      })
    );
  };

  return (
    <>
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
            {/* Download button */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDownload(); }}
              className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-lg bg-black/50 backdrop-blur-sm text-white transition-all hover:bg-black/70"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
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
                <span className="flex items-center gap-1.5 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 ring-1 ring-zinc-200 dark:ring-white/5">
                  <img key={selectedImage.id} src={modelLogo} alt="" className="h-4 w-4" />
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
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                    Prompt
                  </h3>
                  {availableLangs.length > 1 && (
                    <div className="flex gap-1">
                      {availableLangs.map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setPromptLang(lang)}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                            promptLang === lang
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {{ en: "EN", zh: "中", ja: "日" }[lang]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="scrollbar-hide group/prompt max-h-[70vh] overflow-y-auto rounded-xl bg-zinc-50 dark:bg-zinc-800/40 p-4 ring-1 ring-zinc-200 dark:ring-white/5">
                  <div className="flex items-start gap-2">
                    <p className="flex-1 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                      {promptText}
                    </p>
                    {/* Copy button inside prompt box */}
                    <button
                      onClick={copyPrompt}
                      className="flex-shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                      title="Copy prompt"
                    >
                      {copied ? (
                        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom actions */}
            <div className="flex-shrink-0 border-t border-zinc-200 dark:border-white/5 p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => void handleOpenRemixStudio()}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Remix in Studio
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
                  onClick={() => { setSelectedImage(img); setPromptLang("en"); }}
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
                    sizes="60px"
                    unoptimized
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

    </>
  );
}
