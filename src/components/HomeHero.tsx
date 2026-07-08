"use client";

import Image from "next/image";
import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { ImagePrompt } from "@/lib/types";

interface HomeHeroProps {
  coverImage: ImagePrompt;
  onOpen: () => void;
}

export default function HomeHero({ coverImage, onOpen }: HomeHeroProps) {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");
  const [phase, setPhase] = useState<"idle" | "flipping" | "exiting" | "gone">("idle");
  const [isLoaded, setIsLoaded] = useState(false);

  const handleFlip = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("flipping");

    // Phase 1: 翻页动画 1.8s
    setTimeout(() => {
      setPhase("exiting");
      // Phase 2: 滑走 + 通知父组件 1.2s
      setTimeout(() => {
        setPhase("gone");
        onOpen();
      }, 1200);
    }, 1800);
  }, [phase, onOpen]);

  if (phase === "gone") return null;

  const isFlipping = phase === "flipping";
  const isExiting = phase === "exiting";

  return (
    <div
      className={`fixed inset-0 z-50 transition-all duration-800 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${isExiting ? "opacity-0 pointer-events-none" : "opacity-100"}
      `}
      style={{
        perspective: "2000px",
        transform: isExiting ? "translateX(-60%)" : "translateX(0)",
      }}
    >
      {/* 3D 翻页容器 */}
      <div
        className="relative w-full h-full"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform 1800ms cubic-bezier(0.4, 0, 0.2, 1)",
          transform: isFlipping || isExiting
            ? "rotateY(-140deg)"
            : "rotateY(0deg)",
          transformOrigin: "left center",
        }}
      >
        {/* ===== 封面（正面）===== */}
        <div
          className="absolute inset-0 overflow-hidden bg-[#1a1814]"
          style={{ backfaceVisibility: "hidden" }}
        >
          {/* 背景图 */}
          <Image
            src={coverImage.url}
            alt={coverImage.category || tCommon("untitled")}
            fill
            className={`object-cover transition-all duration-1000 ${
              isLoaded ? "photo-focus-in" : "blur-[10px] opacity-0"
            }`}
            priority
            onLoad={() => setIsLoaded(true)}
          />

          {/* 暗角叠加 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent pointer-events-none" />

          {/* 封面内容 */}
          <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-16 lg:p-20">
            <div className="max-w-[1600px] w-full mx-auto">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[#f5f2ed]/60 mb-3">
                {t("hero.volume")}
              </p>
              <h1
                className="text-6xl md:text-7xl lg:text-[6rem] font-bold tracking-tight text-[#f5f2ed] drop-shadow-lg"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                Aestara
              </h1>
              <p
                className="mt-3 text-[11px] text-[#f5f2ed]/50 uppercase tracking-[0.2em]"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                {coverImage.category || tCommon("untitled")} · {coverImage.author}
              </p>
            </div>
          </div>

          {/* 右下角折角 */}
          <button
            onClick={handleFlip}
            className="absolute bottom-0 right-0 w-28 h-28 md:w-36 md:h-36 cursor-pointer group z-10"
            aria-label={t("hero.openAriaLabel")}
          >
            {/* 折角阴影 */}
            <div
              className="absolute bottom-0 right-0 w-0 h-0"
              style={{
                borderStyle: "solid",
                borderWidth: "0 0 144px 144px",
                borderColor: "transparent transparent rgba(0,0,0,0.15) transparent",
                transform: "translate(2px, 2px)",
                filter: "blur(3px)",
              }}
            />
            {/* 折角主体 */}
            <div
              className="absolute bottom-0 right-0 w-0 h-0 transition-transform duration-300 group-hover:scale-105 origin-bottom-right"
              style={{
                borderStyle: "solid",
                borderWidth: "0 0 144px 144px",
                borderColor: "transparent transparent #f5f2ed transparent",
              }}
            />
            {/* 折角上的提示文字 */}
            <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 flex flex-col items-center gap-1 text-[#2a2520] opacity-50 group-hover:opacity-100 transition-all duration-300">
              <span className="text-[10px] uppercase tracking-[0.2em] font-medium">
                {t("hero.open")}
              </span>
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>

          {/* 左侧书脊阴影（增强 3D 感） */}
          <div
            className="absolute top-0 left-0 bottom-0 w-2 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.15), transparent)",
            }}
          />
        </div>

        {/* ===== 背面（书页背面）===== */}
        <div
          className="absolute inset-0 bg-[#f5f2ed] dark:bg-[#1a1814] flex items-center justify-center"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          {/* 纸张纹理 */}
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage: `radial-gradient(circle at 30% 40%, rgba(0,0,0,0.03) 0%, transparent 60%),
                               radial-gradient(circle at 70% 60%, rgba(0,0,0,0.02) 0%, transparent 50%)`,
            }}
          />
          {/* 书脊处阴影 */}
          <div
            className="absolute top-0 left-0 bottom-0 w-3"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.08), transparent)",
            }}
          />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#8a837a] dark:text-[#5c564e]">
              {t("hero.openingGallery")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
