"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isBillingEnabled,
  isSelfServiceApiKeysEnabled,
} from "@/lib/billing-feature";
import {
  readRemixGenerationDraft,
  saveRemixGenerationDraft,
  type RemixGenerationDraft,
} from "@/lib/generation-draft";
import { useAppStore } from "@/store";
import type { ImagePrompt } from "@/lib/types";

interface GenerationTask {
  id: string;
  prompt: string;
  model: string;
  source_image_id?: string | null;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  result_url?: string;
  error_message?: string;
  credits_cost?: number;
  created_at: string;
}

const MODELS = [
  { id: "doubao-seedream-5-0-260128", name: "Seedream 5.0" },
  { id: "seedream-v3", name: "Seedream v3" },
] as const;

const SIZES = [
  { id: "1K", label: "1K", width: 1024, height: 1024 },
  { id: "2K", label: "2K", width: 2048, height: 2048 },
  { id: "3K", label: "3K", width: 3072, height: 3072 },
] as const;

function getTaskPresentation(
  status: GenerationTask["status"] | "idle"
): {
  label: string;
  badgeClassName: string;
  helperText: string;
} {
  switch (status) {
    case "completed":
      return {
        label: "Rendered",
        badgeClassName:
          "bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300",
        helperText: "A fresh image has landed in the studio.",
      };
    case "failed":
      return {
        label: "Interrupted",
        badgeClassName:
          "bg-rose-500/12 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300",
        helperText: "The render stopped before completion.",
      };
    case "processing":
    case "queued":
      return {
        label: "Developing",
        badgeClassName:
          "bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300",
        helperText: "The next composition is taking shape.",
      };
    default:
      return {
        label: "Awaiting prompt",
        badgeClassName:
          "bg-zinc-900/6 text-zinc-600 ring-1 ring-zinc-900/10 dark:bg-white/8 dark:text-zinc-300 dark:ring-white/10",
        helperText: "Start with a prompt and the studio will stage the result here.",
      };
  }
}

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppStore((s) => s.user);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const billingEnabled = isBillingEnabled();
  const selfServiceApiKeysEnabled = isSelfServiceApiKeysEnabled();
  const isRemixMode = searchParams.get("mode") === "remix";
  const sourceImageId = searchParams.get("sourceImageId");
  const returnTo = searchParams.get("returnTo") ?? "gallery";

  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentTask, setCurrentTask] = useState<GenerationTask | null>(null);
  const [stagedTasks, setStagedTasks] = useState<GenerationTask[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [remixDraft, setRemixDraft] = useState<RemixGenerationDraft | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<
    (typeof MODELS)[number]["id"]
  >(MODELS[0].id);
  const [selectedSize, setSelectedSize] = useState<
    (typeof SIZES)[number]["id"]
  >(SIZES[1].id);
  const stageRailRef = useRef<HTMLDivElement>(null);

  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      const json = await res.json();
      if (res.ok) {
        setCredits(json.credits);
      }
    } catch (fetchError) {
      console.error("Error fetching credits:", fetchError);
    }
  }, []);

  const checkApiKey = useCallback(async () => {
    try {
      const res = await fetch("/api/user/api-keys");
      const json = await res.json();
      if (res.ok) {
        const hasDoubao = json.data?.some(
          (key: { provider: string }) => key.provider === "doubao"
        );
        setHasApiKey(hasDoubao || false);
      }
    } catch (checkError) {
      console.error("Error checking API key:", checkError);
      setHasApiKey(false);
    }
  }, []);

  const fetchRemixSeries = useCallback(
    async (nextSourceImageId: string) => {
      const res = await fetch(
        `/api/generations?status=completed&sourceImageId=${encodeURIComponent(nextSourceImageId)}&limit=20`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load remix series");
      }

      const tasks = Array.isArray(json.data) ? (json.data as GenerationTask[]) : [];
      return [...tasks].reverse();
    },
    []
  );

  useEffect(() => {
    if (!user) {
      router.push("/");
      return;
    }

    if (selfServiceApiKeysEnabled) {
      void checkApiKey();
    } else {
      setHasApiKey(true);
    }

    if (billingEnabled) {
      void fetchCredits();
    }
  }, [
    billingEnabled,
    checkApiKey,
    fetchCredits,
    router,
    selfServiceApiKeysEnabled,
    user,
  ]);

  useEffect(() => {
    if (!user) return;

    if (!isRemixMode) {
      setRemixDraft(null);
      setPrompt("");
      return;
    }

    const draft = readRemixGenerationDraft();
    if (draft && (!sourceImageId || draft.sourceImageId === sourceImageId)) {
      setRemixDraft(draft);
      setPrompt(draft.prompt);
      return;
    }

    if (!sourceImageId) {
      setRemixDraft(null);
      setPrompt("");
      return;
    }

    let isActive = true;

    const hydrateDraft = async () => {
      try {
        const res = await fetch(`/api/images/${encodeURIComponent(sourceImageId)}`);
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json.error || "Failed to load source image");
        }

        const sourceImage = json as ImagePrompt;
        if (!sourceImage) {
          throw new Error("Failed to load source image");
        }

        const promptFromImage =
          sourceImage.prompt || sourceImage.prompt_zh || sourceImage.prompt_ja;

        const nextDraft: RemixGenerationDraft = {
          mode: "remix",
          sourceImageId,
          prompt: promptFromImage,
          promptLang: "en",
          sourceImage,
          returnTo: returnTo === "original" ? "original" : "gallery",
          returnImageId: searchParams.get("returnImageId") || sourceImageId,
          createdAt: Date.now(),
        };

        if (!isActive) return;

        setRemixDraft(nextDraft);
        setPrompt(promptFromImage);
      } catch {
        if (!isActive) return;
        setRemixDraft(null);
        setPrompt("");
      }
    };

    void hydrateDraft();

    return () => {
      isActive = false;
    };
  }, [isRemixMode, returnTo, searchParams, sourceImageId, user]);

  useEffect(() => {
    if (!isRemixMode || !remixDraft) {
      return;
    }

    saveRemixGenerationDraft({
      ...remixDraft,
      prompt,
      sourceImage: remixDraft.sourceImage,
    });
  }, [isRemixMode, prompt, remixDraft]);

  useEffect(() => {
    setCurrentTask(null);
    setHoveredTaskId(null);

    if (!isRemixMode || !sourceImageId || !user?.id) {
      setStagedTasks([]);
      return;
    }

    let isActive = true;

    const hydrateSeries = async () => {
      try {
        const tasks = await fetchRemixSeries(sourceImageId);
        if (!isActive) return;
        setStagedTasks(tasks);
      } catch {
        if (!isActive) return;
        setStagedTasks([]);
      }
    };

    void hydrateSeries();

    return () => {
      isActive = false;
    };
  }, [fetchRemixSeries, isRemixMode, sourceImageId, user?.id]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || submitting) return;

    setSubmitting(true);
    setError(null);
    setCurrentTask(null);

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          size: selectedSize,
          sourceImageId: isRemixMode ? sourceImageId : null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create generation");
        if (selfServiceApiKeysEnabled && json.error?.includes("API key")) {
          setHasApiKey(false);
        }
        if (billingEnabled) {
          void fetchCredits();
        }
        return;
      }

      setCurrentTask(json.task);

      if (isRemixMode && sourceImageId && json.task.result_url) {
        setStagedTasks((previous) =>
          [
            ...previous.filter((task) => task.id !== json.task.id),
            json.task as GenerationTask,
          ].slice(-10)
        );
      }

      if (!isRemixMode) {
        setPrompt("");
      }
      if (billingEnabled) {
        void fetchCredits();
      }
    } catch (submitError) {
      console.error("Error creating generation:", submitError);
      setError("An error occurred. Please try again.");
      if (billingEnabled) {
        void fetchCredits();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  const creditCount = credits ?? 0;
  const generateDisabled =
    submitting ||
    !prompt.trim() ||
    (selfServiceApiKeysEnabled && !hasApiKey) ||
    (billingEnabled && creditCount < 1);
  const studioStatus = getTaskPresentation(
    submitting ? "processing" : currentTask?.status ?? "idle"
  );
  const titleFont =
    '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif';
  const sourceImageUrl = remixDraft?.sourceImage?.url || null;
  const renderedTasks = stagedTasks.filter((task) => task.result_url);
  const primaryTask =
    renderedTasks.at(-1) ||
    (currentTask?.status === "completed" && currentTask.result_url ? currentTask : null);
  const activeTaskId = hoveredTaskId ?? primaryTask?.id ?? null;
  const resultImageUrl = primaryTask?.result_url || null;
  const showComparisonStage = isRemixMode && Boolean(sourceImageUrl);
  const toolbarDisabled = generateDisabled;
  const hasRenderedResults = renderedTasks.length > 0;

  const handleStageWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const rail = stageRailRef.current;
    if (!rail) return;

    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
      return;
    }

    event.preventDefault();
    rail.scrollBy({
      left: event.deltaY,
      behavior: "auto",
    });
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#f3efe9] text-zinc-900 dark:bg-[#111215] dark:text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9),rgba(243,239,233,0.75)_38%,rgba(243,239,233,0.94)_72%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(17,18,21,0.82)_38%,rgba(17,18,21,0.96)_72%)]" />
      {sourceImageUrl ? (
        <div
          className="pointer-events-none fixed left-[6%] top-8 h-[78vh] w-[28vw] rounded-[48px] opacity-30 blur-[70px]"
          style={{ background: `center / cover no-repeat url(${sourceImageUrl})` }}
        />
      ) : null}
      {(resultImageUrl || sourceImageUrl) ? (
        <div
          className="pointer-events-none fixed right-[6%] top-10 h-[78vh] w-[28vw] rounded-[48px] opacity-30 blur-[70px]"
          style={{ background: `center / cover no-repeat url(${resultImageUrl || sourceImageUrl})` }}
        />
      ) : null}

      <main className="relative mx-auto flex min-h-screen max-w-[1460px] flex-col px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="z-20 flex items-center justify-between gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-full bg-white/78 px-4 py-2 text-sm font-medium text-zinc-600 shadow-[0_10px_35px_rgba(34,24,15,0.08)] backdrop-blur-xl transition-colors hover:bg-white hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12 dark:hover:text-white"
          >
            &larr; Back to gallery
          </button>

          <div className="flex items-center gap-2">
            {billingEnabled ? (
              <div className="rounded-full bg-white/78 px-4 py-2 text-sm font-medium text-zinc-700 shadow-[0_10px_35px_rgba(34,24,15,0.08)] backdrop-blur-xl dark:bg-white/8 dark:text-zinc-200">
                {credits ?? "—"} credits
              </div>
            ) : null}
            <button
              onClick={toggleTheme}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/78 text-zinc-500 shadow-[0_10px_35px_rgba(34,24,15,0.08)] backdrop-blur-xl transition-colors hover:bg-white hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12 dark:hover:text-white"
            >
              {theme === "light" ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center">
          <div className="rounded-full bg-white/54 px-4 py-1 text-[11px] uppercase tracking-[0.28em] text-zinc-500 backdrop-blur-xl dark:bg-white/6 dark:text-zinc-400">
            {isRemixMode ? "Remix studio" : "Generate studio"}
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center pb-[22rem] pt-12 sm:pb-[24rem] lg:pb-[26rem]">
          <div
            ref={stageRailRef}
            onWheel={handleStageWheel}
            className="flex w-full max-w-[1240px] items-end gap-5 overflow-x-auto pb-4 pl-2 pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {showComparisonStage ? (
              <div className="group relative flex-shrink-0">
                <div className="absolute inset-0 rounded-[32px] bg-white/28 blur-2xl" />
                <div className="relative overflow-hidden rounded-[32px] bg-white/78 shadow-[0_20px_70px_rgba(35,25,15,0.12)] ring-1 ring-white/50 backdrop-blur-xl transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.015] group-hover:shadow-[0_28px_90px_rgba(35,25,15,0.18)] group-hover:ring-white/75 dark:bg-white/8 dark:ring-white/10 dark:group-hover:ring-white/20">
                  {sourceImageUrl ? (
                    <Image
                      src={sourceImageUrl}
                      alt=""
                      width={720}
                      height={1200}
                      unoptimized
                      className="h-auto w-[280px] sm:w-[320px] lg:w-[360px] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="aspect-[4/5] w-[280px] sm:w-[320px] lg:w-[360px] bg-white/30 dark:bg-white/6" />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/90 backdrop-blur-sm">
                      Reference
                    </span>
                  </div>
                </div>
              </div>
            ) : null}

            {hasRenderedResults ? (
              renderedTasks.map((task, index) => {
                const isLatest = task.id === primaryTask?.id;
                const isActiveCard = task.id === activeTaskId;
                const tilt = isActiveCard ? 0 : index % 2 === 0 ? -2.5 : -1.5;
                const widthClass = isActiveCard
                  ? "w-[300px] sm:w-[360px] lg:w-[420px]"
                  : "w-[184px] sm:w-[208px] lg:w-[230px]";

                return (
                  <div
                    key={task.id}
                    className="group relative z-0 flex-shrink-0 transition-[z-index] duration-300 hover:z-20"
                    onMouseEnter={() => setHoveredTaskId(task.id)}
                    onMouseLeave={() => setHoveredTaskId(null)}
                    onFocus={() => setHoveredTaskId(task.id)}
                    onBlur={() => setHoveredTaskId(null)}
                    style={{
                      transform: `rotate(${tilt}deg)`,
                      marginLeft: index === 0 ? "0px" : "-6px",
                    }}
                  >
                    <div className={`absolute inset-0 rounded-[28px] ${isLatest ? "bg-white/28 blur-2xl" : "bg-white/18 blur-xl"}`} />
                    <div
                      className={`relative overflow-hidden rounded-[28px] backdrop-blur-xl transition-all duration-500 ease-out group-hover:-translate-y-2 group-hover:scale-[1.015] ${
                        isActiveCard
                          ? "bg-white/86 shadow-[0_24px_80px_rgba(35,25,15,0.16)] ring-1 ring-white/65 dark:bg-white/10 dark:ring-white/12"
                          : "bg-white/68 shadow-[0_16px_44px_rgba(35,25,15,0.14)] ring-1 ring-white/55 group-hover:shadow-[0_26px_68px_rgba(35,25,15,0.2)] group-hover:ring-white/80 dark:bg-white/8 dark:ring-white/10 dark:group-hover:ring-white/18"
                      }`}
                    >
                      <Image
                        src={task.result_url!}
                        alt="Generated result"
                        width={960}
                        height={1200}
                        unoptimized
                        className={`${widthClass} h-auto object-cover transition-all duration-700 ease-out group-hover:scale-[1.03] ${
                          isActiveCard
                            ? ""
                            : "brightness-[0.9] saturate-[0.84] contrast-[0.94] group-hover:brightness-100 group-hover:saturate-100 group-hover:contrast-100"
                        }`}
                      />
                      {!isActiveCard ? (
                        <div className="pointer-events-none absolute inset-0 bg-white/14 opacity-100 backdrop-blur-[1.5px] transition-all duration-300 group-hover:bg-white/0 group-hover:opacity-0 group-hover:backdrop-blur-0" />
                      ) : null}
                      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        <span className="rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/90 backdrop-blur-sm">
                          {isActiveCard
                            ? isLatest
                              ? "Latest result"
                              : "Inspecting pass"
                            : "Earlier pass"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 rounded-[36px] bg-white/28 blur-2xl" />
                <div className="relative overflow-hidden rounded-[36px] bg-white/84 shadow-[0_24px_80px_rgba(35,25,15,0.12)] ring-1 ring-white/55 backdrop-blur-xl dark:bg-white/8 dark:ring-white/10">
                  <div className="flex aspect-[4/5] w-[300px] sm:w-[360px] lg:w-[420px] items-center justify-center px-10 text-center">
                    <div>
                      <p
                        className="text-[34px] leading-none text-zinc-900 dark:text-white"
                        style={{ fontFamily: titleFont }}
                      >
                        Compose a new image
                      </p>
                      <p className="mt-4 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                        {studioStatus.helperText}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center sm:bottom-14">
            <div className="pointer-events-auto w-full max-w-[1120px] rounded-[30px] bg-white/90 shadow-[0_44px_125px_rgba(33,24,15,0.24)] ring-1 ring-white/60 backdrop-blur-2xl dark:bg-[#13151a]/88 dark:ring-white/10 dark:shadow-[0_36px_125px_rgba(0,0,0,0.46)]">
              <form onSubmit={(event) => void handleSubmit(event)} className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-zinc-400 dark:text-zinc-500">
                      {isRemixMode ? "Remix from image" : "Prompt composer"}
                    </p>
                    <p
                      className="mt-2 text-[26px] leading-none text-zinc-900 dark:text-white"
                      style={{ fontFamily: titleFont }}
                    >
                      {isRemixMode ? "Refine the original into something new" : "Write the frame you want to see"}
                    </p>
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    {studioStatus.label}
                  </div>
                </div>

                {selfServiceApiKeysEnabled && hasApiKey === false ? (
                  <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    Configure your Doubao API key in Settings before rendering from this studio.
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-300">
                    {error}
                  </div>
                ) : null}

                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Describe the image you want to generate..."
                  rows={5}
                  className="mt-4 w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-zinc-800 outline-none placeholder:text-zinc-400 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />

                <div className="mt-5 flex flex-col gap-3 border-t border-black/6 pt-4 dark:border-white/8 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isRemixMode && remixDraft) {
                          setPrompt(remixDraft.prompt);
                        }
                      }}
                      className="rounded-full bg-black/5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/10 hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12 dark:hover:text-white"
                    >
                      Use original prompt
                    </button>
                    {MODELS.map((model) => {
                      const isActive = selectedModel === model.id;
                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => setSelectedModel(model.id)}
                          className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                              : "bg-black/5 text-zinc-600 hover:bg-black/10 hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12 dark:hover:text-white"
                          }`}
                        >
                          {model.name}
                        </button>
                      );
                    })}
                    {SIZES.map((size) => {
                      const isActive = selectedSize === size.id;
                      return (
                        <button
                          key={size.id}
                          type="button"
                          onClick={() => setSelectedSize(size.id)}
                          className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                            isActive
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                              : "bg-black/5 text-zinc-600 hover:bg-black/10 hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12 dark:hover:text-white"
                          }`}
                        >
                          {size.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    {billingEnabled ? (
                      <div className="rounded-full bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        x1 credit
                      </div>
                    ) : null}
                    <button
                      type="submit"
                      disabled={toolbarDisabled}
                      className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {submitting ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
                          Rendering...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {isRemixMode ? "Generate variation" : "Generate image"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
