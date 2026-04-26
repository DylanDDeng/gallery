"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { MOCK_IMAGES } from "@/lib/constants";

const FEATURED = MOCK_IMAGES.slice(0, 5);

export default function HomeHero() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const goTo = useCallback(
    (index: number) => {
      if (isTransitioning) return;
      setIsTransitioning(true);
      setActiveIndex(index);
      setTimeout(() => setIsTransitioning(false), 800);
    },
    [isTransitioning]
  );

  const next = useCallback(() => {
    goTo((activeIndex + 1) % FEATURED.length);
  }, [activeIndex, goTo]);

  // Auto-advance every 5s
  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const current = FEATURED[activeIndex];

  return (
    <section className="relative overflow-hidden border-b border-[#d5cfc4] dark:border-[#f5f2ed]/10">
      <div className="mx-auto max-w-[1600px] px-6 py-16 md:py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left: Editorial Text */}
          <div className="lg:col-span-5 space-y-8">
            <div className="space-y-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#8a837a]">
                AI Image Generation
              </p>
              <h1
                className="text-5xl md:text-6xl lg:text-[5.5rem] font-normal leading-[0.95] tracking-tight text-[#141210] dark:text-[#ebe7e0]"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Where
                <br />
                imagination
                <br />
                <em className="italic">meets craft</em>
              </h1>
            </div>
            <p className="text-base md:text-lg text-[#5c564e] dark:text-[#8a837a] leading-relaxed max-w-md">
              Explore a curated gallery of AI-generated imagery. Create your
              own, remix styles, and build your collection.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <Link
                href="/generate"
                className="inline-flex items-center gap-2 rounded-full bg-[#141210] px-7 py-3.5 text-sm font-medium text-[#f5f2ed] transition-all hover:bg-[#1a1814] dark:bg-[#f5f2ed] dark:text-[#141210] dark:hover:bg-[#d5cfc4]"
              >
                Start Creating
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
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
              <button
                onClick={() => {
                  document
                    .getElementById("gallery")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-[#a39b90] px-7 py-3.5 text-sm font-medium text-[#2a2520] transition-all hover:border-[#8a837a] hover:bg-[#ebe7e0] dark:border-[#2a2520] dark:text-[#a39b90] dark:hover:border-[#5c564e] dark:hover:bg-[#1a1814]/50"
              >
                Browse Gallery
              </button>
            </div>
          </div>

          {/* Right: Carousel */}
          <div className="lg:col-span-7 relative">
            <div className="group/carousel relative aspect-[4/3] md:aspect-[16/10] overflow-hidden rounded-sm bg-[#e0d9ce] dark:bg-[#1a1814] shadow-2xl">
              {FEATURED.map((img, i) => {
                const isActive = i === activeIndex;
                return (
                  <div
                    key={img.id}
                    className="absolute inset-0 transition-all duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                    style={{
                      opacity: isActive ? 1 : 0,
                      transform: isActive ? "scale(1)" : "scale(1.06)",
                      zIndex: isActive ? 2 : 1,
                    }}
                  >
                    <Image
                      src={img.url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      priority={i === 0}
                    />
                  </div>
                );
              })}

              {/* Subtle editorial overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />

              {/* Side navigation arrows */}
              <button
                onClick={() =>
                  goTo((activeIndex - 1 + FEATURED.length) % FEATURED.length)
                }
                className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#f5f2ed]/10 backdrop-blur-md flex items-center justify-center text-[#f5f2ed]/70 hover:text-[#f5f2ed] hover:bg-[#f5f2ed]/20 transition-all opacity-0 group-hover/carousel:opacity-100"
                aria-label="Previous"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={next}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#f5f2ed]/10 backdrop-blur-md flex items-center justify-center text-[#f5f2ed]/70 hover:text-[#f5f2ed] hover:bg-[#f5f2ed]/20 transition-all opacity-0 group-hover/carousel:opacity-100"
                aria-label="Next"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Bottom: progress dots + caption */}
              <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p
                    className="text-[#f5f2ed] text-lg italic leading-snug line-clamp-2 drop-shadow-sm"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    {current.category || "Untitled"}
                  </p>
                  <p className="text-[#f5f2ed]/50 text-[10px] uppercase tracking-[0.15em] mt-1 drop-shadow-sm">
                    {current.author} · {current.model}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {FEATURED.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => goTo(i)}
                      className={`transition-all duration-500 rounded-full ${
                        i === activeIndex
                          ? "w-6 h-1.5 bg-[#f5f2ed]"
                          : "w-1.5 h-1.5 bg-[#f5f2ed]/40 hover:bg-[#f5f2ed]/60"
                      }`}
                      aria-label={`Go to slide ${i + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Editorial caption below image */}
            <div className="mt-5 flex items-start justify-between gap-6">
              <p className="text-xs text-[#8a837a] dark:text-[#5c564e] leading-relaxed max-w-sm">
                {FEATURED.length} featured works selected from the community gallery
              </p>
              <div className="flex items-center gap-3 text-[11px] text-[#8a837a] dark:text-[#5c564e] uppercase tracking-wider">
                <span>{String(activeIndex + 1).padStart(2, "0")}</span>
                <span className="w-6 h-px bg-[#a39b90] dark:bg-[#2a2520]" />
                <span>{String(FEATURED.length).padStart(2, "0")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
