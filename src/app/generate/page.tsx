"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  isBillingEnabled,
  isSelfServiceApiKeysEnabled,
} from "@/lib/billing-feature";
import {
  buildRemixGenerateUrl,
  parseGenerationDraftFromSearchParams,
  readRemixContextSnapshot,
  readRemixGenerationDraft,
  saveRemixContextSnapshot,
  saveRemixGenerationDraft,
  type RemixGenerationDraft,
  type RemixSeriesItem,
} from "@/lib/generation-draft";
import { useAppStore } from "@/store";
import {
  ASPECT_RATIO_OPTIONS,
  OUTPUT_RESOLUTIONS,
  getOutputSize,
  type AspectRatio,
  type OutputResolution,
} from "@/lib/generation-size-options";
import StudioCanvas, { type StudioCanvasCard } from "@/components/StudioCanvas";
import type { ImagePrompt } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase-browser";

const CREDITS_DEBUG_PREFIX = "[credits-debug]";

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
  { id: "doubao-seedream-5-0-260128", name: "Seedream-5.0-Lite" },
] as const;

const REFERENCE_IMAGE_BUCKET = "generations";
const ALLOWED_REFERENCE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

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

function mergeRemixSeriesItems(
  ...taskGroups: Array<RemixSeriesItem[] | undefined>
) {
  const merged = new Map<string, RemixSeriesItem>();

  for (const group of taskGroups) {
    for (const task of group ?? []) {
      if (!task?.id) continue;
      merged.set(task.id, task);
    }
  }

  return Array.from(merged.values())
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    )
    .slice(-20);
}

function mergeReferenceImages(
  ...imageGroups: Array<Array<Partial<ImagePrompt>> | Partial<ImagePrompt> | null | undefined>
) {
  const merged: Partial<ImagePrompt>[] = [];
  const seen = new Set<string>();

  for (const group of imageGroups) {
    const images = Array.isArray(group) ? group : group ? [group] : [];

    for (const image of images) {
      const url = typeof image?.url === "string" ? image.url.trim() : "";
      if (!url || seen.has(url)) continue;
      seen.add(url);
      merged.push(image);
    }
  }

  return merged;
}

function getReferenceImageLabel(
  image: Partial<ImagePrompt> & { url: string },
  index: number,
  activeUrl: string | null
) {
  if (image.url === activeUrl) {
    return "Current reference";
  }

  const prompt = typeof image.prompt === "string" ? image.prompt.trim() : "";
  return prompt || `Reference ${index + 1}`;
}

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppStore((s) => s.user);
  const credits = useAppStore((s) => s.credits);
  const setCredits = useAppStore((s) => s.setCredits);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
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
  const [stagedTasks, setStagedTasks] = useState<RemixSeriesItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [remixDraft, setRemixDraft] = useState<RemixGenerationDraft | null>(null);
  const [canvasReferenceImages, setCanvasReferenceImages] = useState<Partial<ImagePrompt>[]>([]);
  const [isRestoringSeries, setIsRestoringSeries] = useState(false);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<
    (typeof MODELS)[number]["id"]
  >(MODELS[0].id);
  const [selectedResolution, setSelectedResolution] = useState<OutputResolution>("2K");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("1:1");
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const remixHydrationRequestRef = useRef(0);
  const selectedOutputSize = getOutputSize(selectedResolution, selectedAspectRatio);

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

  const fetchRemixContext = useCallback(
    async (nextSourceImageId: string) => {
      const res = await fetch(
        `/api/generations/remix-context?sourceImageId=${encodeURIComponent(nextSourceImageId)}`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to load remix context");
      }

      return {
        sourceImage: json.sourceImage as ImagePrompt,
        tasks: Array.isArray(json.tasks) ? (json.tasks as RemixSeriesItem[]) : [],
      };
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

  }, [
    billingEnabled,
    checkApiKey,
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

    const storedDraft = readRemixGenerationDraft();
    const urlDraft = parseGenerationDraftFromSearchParams(
      new URLSearchParams(searchParams.toString())
    );
    const draft =
      storedDraft &&
      (!sourceImageId ||
        storedDraft.sourceImageId === sourceImageId ||
        storedDraft.sourceImage?.id === sourceImageId)
        ? storedDraft
        : urlDraft?.mode === "remix"
          ? {
              mode: "remix" as const,
              prompt: urlDraft.prompt ?? "",
              promptLang: "en" as const,
              createdAt: Date.now(),
              sourceImageId: urlDraft.sourceImageId,
              sourceImage: urlDraft.sourceImage,
              referenceImages: urlDraft.sourceImage?.url
                ? [urlDraft.sourceImage]
                : [],
              returnTo: urlDraft.returnTo,
              returnImageId: urlDraft.returnImageId,
            }
          : null;

    if (!draft?.sourceImage?.url && !draft?.sourceImageId && !sourceImageId) {
      setRemixDraft(null);
      setPrompt("");
      return;
    }

    if (draft) {
      setRemixDraft(draft);
      setPrompt(draft.prompt);
    }
  }, [isRemixMode, searchParams, sourceImageId, user]);

  useEffect(() => {
    if (!isRemixMode || !sourceImageId || !user?.id) {
      setIsRestoringSeries(false);
      return;
    }

    const hydrationRequestId = ++remixHydrationRequestRef.current;
    setCurrentTask(null);

    const draft = readRemixGenerationDraft();
    const snapshot = readRemixContextSnapshot(user.id, sourceImageId);
    const urlDraft = parseGenerationDraftFromSearchParams(
      new URLSearchParams(searchParams.toString())
    );
    const persistedSourceImage =
      draft
        ? draft.sourceImage?.url
          ? draft.sourceImage
          : undefined
        : snapshot
          ? snapshot.sourceImage?.url
            ? snapshot.sourceImage
            : undefined
          : urlDraft?.mode === "remix" && urlDraft.sourceImage?.url
            ? urlDraft.sourceImage
            : undefined;
    const persistedReferenceImages = mergeReferenceImages(
      snapshot?.referenceImages,
      snapshot?.sourceImage?.url ? snapshot.sourceImage : null,
      draft?.referenceImages,
      draft?.sourceImage?.url ? draft.sourceImage : null,
      urlDraft?.mode === "remix" && urlDraft.sourceImage?.url
        ? urlDraft.sourceImage
        : null
    );

    if (snapshot) {
      const snapshotPrompt =
        draft?.prompt ||
        snapshot.sourceImage.prompt ||
        snapshot.sourceImage.prompt_zh ||
        snapshot.sourceImage.prompt_ja ||
        "";

      setRemixDraft({
        mode: "remix",
        sourceImageId,
        prompt: snapshotPrompt,
        promptLang: draft?.promptLang || "en",
        sourceImage: persistedSourceImage,
        referenceImages: persistedReferenceImages,
        returnTo: returnTo === "original" ? "original" : "gallery",
        returnImageId: searchParams.get("returnImageId") || sourceImageId,
        createdAt: Date.now(),
      });
      setCanvasReferenceImages(persistedReferenceImages);
      setPrompt(snapshotPrompt);
      setStagedTasks(snapshot.tasks);
    } else {
      setStagedTasks([]);
      setCanvasReferenceImages(persistedReferenceImages);
    }

    let isActive = true;

    const hydrateContext = async () => {
      setIsRestoringSeries(true);
      try {
        const context = await fetchRemixContext(sourceImageId);
        const mergedTasks = mergeRemixSeriesItems(
          snapshot?.tasks,
          context.tasks
        );
        const mergedReferenceImages = mergeReferenceImages(
          persistedReferenceImages,
          !draft && !snapshot && !(urlDraft?.mode === "remix" && urlDraft.sourceImage?.url)
            ? context.sourceImage
            : null
        );
        const promptFromImage =
          draft?.prompt ||
          context.sourceImage.prompt ||
          context.sourceImage.prompt_zh ||
          context.sourceImage.prompt_ja ||
          "";

        const nextDraft: RemixGenerationDraft = {
          mode: "remix",
          sourceImageId,
          prompt: promptFromImage,
          promptLang: "en",
          sourceImage:
            draft || snapshot || (urlDraft?.mode === "remix" && urlDraft.sourceImage)
              ? persistedSourceImage
              : context.sourceImage,
          referenceImages: mergedReferenceImages,
          returnTo: returnTo === "original" ? "original" : "gallery",
          returnImageId: searchParams.get("returnImageId") || sourceImageId,
          createdAt: Date.now(),
        };

        if (
          !isActive ||
          remixHydrationRequestRef.current !== hydrationRequestId
        ) {
          return;
        }

        setRemixDraft(nextDraft);
        setCanvasReferenceImages(mergedReferenceImages);
        setPrompt(promptFromImage);
        setStagedTasks(mergedTasks);
        saveRemixContextSnapshot(user.id, sourceImageId, {
          sourceImage: nextDraft.sourceImage ?? {},
          referenceImages: mergedReferenceImages,
          tasks: mergedTasks,
          savedAt: Date.now(),
        });
      } catch {
        if (
          !isActive ||
          remixHydrationRequestRef.current !== hydrationRequestId
        ) {
          return;
        }
      } finally {
        if (
          !isActive ||
          remixHydrationRequestRef.current !== hydrationRequestId
        ) {
          return;
        }
        setIsRestoringSeries(false);
      }
    };

    void hydrateContext();

    return () => {
      isActive = false;
    };
  }, [fetchRemixContext, isRemixMode, returnTo, searchParams, sourceImageId, user?.id]);

  useEffect(() => {
    if (!isRemixMode || !remixDraft) {
      return;
    }

    saveRemixGenerationDraft({
      ...remixDraft,
      prompt,
      sourceImage: remixDraft.sourceImage,
      referenceImages: remixDraft.referenceImages,
    });
  }, [isRemixMode, prompt, remixDraft]);

  useEffect(() => {
    if (!isRemixMode) {
      setCanvasReferenceImages([]);
      return;
    }

    setCanvasReferenceImages(
      mergeReferenceImages(
        remixDraft?.referenceImages,
        remixDraft?.sourceImage?.url ? remixDraft.sourceImage : null
      )
    );
  }, [isRemixMode, remixDraft?.referenceImages, remixDraft?.sourceImage]);

  const handlePickReferenceImage = useCallback(() => {
    referenceInputRef.current?.click();
  }, []);

  const handleReferenceFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file || !user) {
        return;
      }

      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file.");
        return;
      }

      if (!ALLOWED_REFERENCE_MIME_TYPES.has(file.type)) {
        setError("Please upload a PNG, JPEG, WEBP, or GIF image.");
        return;
      }

      remixHydrationRequestRef.current += 1;
      setIsUploadingReference(true);
      setError(null);

      try {
        const supabase = createBrowserSupabaseClient();
        const {
          data: { user: authUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw new Error(authError.message || "Please sign in again before uploading a reference image.");
        }

        if (!authUser) {
          throw new Error("Please sign in again before uploading a reference image.");
        }

        const extension = file.name.includes(".")
          ? file.name.split(".").pop()?.toLowerCase() || "png"
          : file.type === "image/jpeg"
            ? "jpg"
            : file.type === "image/webp"
              ? "webp"
              : file.type === "image/gif"
                ? "gif"
                : "png";
        const filePath = `${authUser.id}/reference-images/${Date.now()}-${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from(REFERENCE_IMAGE_BUCKET)
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message || "Failed to upload reference image");
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from(REFERENCE_IMAGE_BUCKET).getPublicUrl(filePath);
        const nextSourceImageId = sourceImageId || undefined;
        const nextSourceImage = {
          url: publicUrl,
          prompt: file.name,
        };
        const nextReferenceImages = mergeReferenceImages(
          canvasReferenceImages,
          nextSourceImage
        );

        setRemixDraft((previous) => ({
          mode: "remix",
          prompt: previous?.prompt ?? prompt,
          promptLang: previous?.promptLang ?? "en",
          createdAt: Date.now(),
          sourceImageId: previous?.sourceImageId ?? nextSourceImageId,
          sourceImage: previous?.sourceImage?.url ? previous.sourceImage : nextSourceImage,
          referenceImages: nextReferenceImages,
          returnTo: previous?.returnTo ?? "gallery",
          returnImageId: previous?.returnImageId,
        }));
        setCanvasReferenceImages(nextReferenceImages);

        if (user.id && nextSourceImageId) {
          saveRemixContextSnapshot(user.id, nextSourceImageId, {
            sourceImage: nextSourceImage,
            referenceImages: nextReferenceImages,
            tasks: stagedTasks,
            savedAt: Date.now(),
          });
        }

        router.replace(
          buildRemixGenerateUrl({
            sourceImageId: sourceImageId || undefined,
            sourceImageUrl: publicUrl,
            returnTo: returnTo === "original" ? "original" : "gallery",
            returnImageId: searchParams.get("returnImageId") || sourceImageId || undefined,
          })
        );
      } catch (uploadError) {
        console.error("Reference image upload failed:", uploadError);
        setError(
          uploadError instanceof Error &&
          /row-level security policy/i.test(uploadError.message)
            ? "Your upload session is not authorized for storage. Please refresh and sign in again."
            : uploadError instanceof Error
              ? uploadError.message
            : "Failed to upload the reference image. Please try again."
        );
      } finally {
        setIsUploadingReference(false);
      }
    },
    [
      canvasReferenceImages,
      prompt,
      returnTo,
      router,
      searchParams,
      sourceImageId,
      stagedTasks,
      user,
    ]
  );

  const handleClearReferenceImage = useCallback(() => {
    remixHydrationRequestRef.current += 1;
    const nextReferenceImages = mergeReferenceImages(
      canvasReferenceImages,
      remixDraft?.sourceImage
    );
    if (user?.id && sourceImageId) {
      saveRemixContextSnapshot(user.id, sourceImageId, {
        sourceImage: {},
        referenceImages: nextReferenceImages,
        tasks: stagedTasks,
        savedAt: Date.now(),
      });
    }
    setCanvasReferenceImages(nextReferenceImages);
    setRemixDraft((previous) => {
      if (!previous) {
        return null;
      }

      return {
        ...previous,
        sourceImageId: previous.sourceImageId ?? sourceImageId ?? undefined,
        sourceImage: undefined,
        referenceImages: nextReferenceImages,
      };
    });

    router.replace(
      buildRemixGenerateUrl({
        sourceImageId: sourceImageId || undefined,
        returnTo: returnTo === "original" ? "original" : "gallery",
        returnImageId: searchParams.get("returnImageId") || sourceImageId || undefined,
      })
    );
  }, [
    canvasReferenceImages,
    remixDraft?.sourceImage,
    returnTo,
    router,
    searchParams,
    sourceImageId,
    stagedTasks,
    user?.id,
  ]);

  const handleSelectReferenceImage = useCallback(
    (image: Partial<ImagePrompt> & { url: string }) => {
      setRemixDraft((previous) => {
        if (!previous) {
          return previous;
        }

        const nextDraft: RemixGenerationDraft = {
          ...previous,
          sourceImageId: previous.sourceImageId ?? sourceImageId ?? undefined,
          sourceImage: image,
          referenceImages: mergeReferenceImages(previous.referenceImages, image),
        };

        if (user?.id && nextDraft.sourceImageId) {
          saveRemixContextSnapshot(user.id, nextDraft.sourceImageId, {
            sourceImage: image,
            referenceImages: nextDraft.referenceImages,
            tasks: stagedTasks,
            savedAt: Date.now(),
          });
        }

        return nextDraft;
      });

      router.replace(
        buildRemixGenerateUrl({
          sourceImageId: sourceImageId || undefined,
          sourceImageUrl: image.url,
          returnTo: returnTo === "original" ? "original" : "gallery",
          returnImageId: searchParams.get("returnImageId") || sourceImageId || undefined,
        })
      );
    },
    [returnTo, router, searchParams, sourceImageId, stagedTasks, user?.id]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setCurrentTask(null);
    const shouldOptimisticallyDeduct =
      billingEnabled && typeof credits === "number" && credits > 0;

    console.info(CREDITS_DEBUG_PREFIX, "generate:submit:start", {
      mode: isRemixMode ? "remix" : "new",
      credits,
      shouldOptimisticallyDeduct,
      selectedResolution,
      selectedAspectRatio,
      outputSize: selectedOutputSize.size,
      selectedModel,
    });

    if (shouldOptimisticallyDeduct) {
      setCredits(credits - 1);
    }

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          size: selectedOutputSize.size,
          sourceImageId: remixDraft?.sourceImage?.url
            ? (remixDraft?.sourceImageId ?? sourceImageId)
            : null,
          sourceImageUrl: remixDraft?.sourceImage?.url ?? null,
        }),
      });

      const json = await res.json();
      console.info(CREDITS_DEBUG_PREFIX, "generate:submit:response", {
        status: res.status,
        ok: res.ok,
        remainingCredits: json.remainingCredits ?? null,
        taskId: json.task?.id ?? null,
      });

      if (!res.ok) {
        if (billingEnabled && (shouldOptimisticallyDeduct || res.status === 402)) {
          await fetchCredits();
        }
        setError(json.error || "Failed to create generation");
        if (selfServiceApiKeysEnabled && json.error?.includes("API key")) {
          setHasApiKey(false);
        }
        return;
      }

      if (billingEnabled) {
        if (typeof json.remainingCredits === "number") {
          setCredits(json.remainingCredits);
        } else {
          void fetchCredits();
        }
      }

      setCurrentTask(json.task);

      if (isRemixMode && json.task.result_url) {
        setStagedTasks((previous) => {
          const next = [
            ...previous.filter((task) => task.id !== json.task.id),
            json.task as RemixSeriesItem,
          ].slice(-10);

          const snapshotSourceImageId = remixDraft?.sourceImageId ?? sourceImageId;

          if (snapshotSourceImageId && user?.id) {
            saveRemixContextSnapshot(user.id, snapshotSourceImageId, {
              sourceImage: remixDraft?.sourceImage ?? {},
              referenceImages: mergeReferenceImages(
                remixDraft?.referenceImages,
                remixDraft?.sourceImage
              ),
              tasks: next,
              savedAt: Date.now(),
            });
          }

          return next;
        });
      }

      if (!isRemixMode) {
        setPrompt("");
      }
    } catch (submitError) {
      console.error(CREDITS_DEBUG_PREFIX, "generate:submit:exception", submitError);
      if (billingEnabled && shouldOptimisticallyDeduct) {
        await fetchCredits();
      }
      console.error("Error creating generation:", submitError);
      setError("An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadTask = useCallback(async (task: { id: string; result_url?: string | null }) => {
    if (!task.result_url || downloadingTaskId === task.id) {
      return;
    }

    setDownloadingTaskId(task.id);
    try {
      const response = await fetch(task.result_url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `remix-${task.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      console.error("Error downloading generated image:", downloadError);
      setError("Failed to download the generated image. Please try again.");
    } finally {
      setDownloadingTaskId((current) => (current === task.id ? null : current));
    }
  }, [downloadingTaskId]);

  if (!user) {
    return null;
  }

  const sourceImageUrl = remixDraft?.sourceImage?.url || null;
  const hasReferenceImage = Boolean(sourceImageUrl);
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
  const renderedTasks = stagedTasks.filter((task) => task.result_url);
  const latestStandaloneTask =
    currentTask?.status === "completed" && currentTask.result_url ? currentTask : null;
  const canvasResultTasks = renderedTasks.length > 0 ? renderedTasks : latestStandaloneTask ? [latestStandaloneTask] : [];
  const resultImageUrl = canvasResultTasks.at(-1)?.result_url || null;
  const canvasCards: StudioCanvasCard[] = [
    ...canvasReferenceImages
      .filter((image): image is Partial<ImagePrompt> & { url: string } => Boolean(image.url))
      .map((image, index) => ({
        id: `reference-card:${image.url}`,
        imageUrl: image.url,
        label: getReferenceImageLabel(image, index, sourceImageUrl),
        kind: "reference" as const,
        selected: image.url === sourceImageUrl,
        onSelect: () => {
          handleSelectReferenceImage(image);
        },
      })),
    ...canvasResultTasks.map((task, index) => ({
      id: task.id,
      imageUrl: task.result_url!,
      label:
        index === canvasResultTasks.length - 1
          ? "Latest result"
          : `Variation ${index + 1}`,
      kind: "result" as const,
      onDownload: () => {
        void handleDownloadTask(task);
      },
    })),
  ];
  const toolbarDisabled = generateDisabled;

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

      <main className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-6 sm:px-6 lg:px-8">
          <div className="pointer-events-auto flex items-center justify-between gap-3">
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
            {billingEnabled ? (
              <button
                onClick={() => router.push((credits ?? 0) > 0 ? "/credits" : "/pricing")}
                className="rounded-full bg-white/78 px-4 py-2 text-sm font-medium text-zinc-700 shadow-[0_10px_35px_rgba(34,24,15,0.08)] backdrop-blur-xl transition-colors hover:bg-white hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-200 dark:hover:bg-white/12 dark:hover:text-white"
              >
                {(credits ?? 0) > 0 ? "Get credits" : "Buy credits"}
              </button>
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
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-6 z-20 flex justify-center">
          <div className="rounded-full bg-white/54 px-4 py-1 text-[11px] uppercase tracking-[0.28em] text-zinc-500 backdrop-blur-xl dark:bg-white/6 dark:text-zinc-400">
            {hasReferenceImage ? "Remix studio" : "Generate studio"}
          </div>
        </div>

        <div className="absolute inset-0">
          <StudioCanvas
            cards={canvasCards}
            emptyTitle={isRestoringSeries ? "Restoring previous variations" : "Compose on the canvas"}
            emptyDescription={
              isRestoringSeries
                ? "We are bringing your previous remix series back onto the canvas."
                : "Move ideas around, attach a reference image when you need it, and let results accumulate as visual branches."
            }
          />
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center px-4 sm:px-6">
          <div className="pointer-events-auto w-full max-w-[960px] rounded-[32px] bg-white/88 shadow-[0_44px_125px_rgba(33,24,15,0.22)] ring-1 ring-white/60 backdrop-blur-2xl dark:bg-[#13151a]/88 dark:ring-white/10 dark:shadow-[0_36px_125px_rgba(0,0,0,0.46)]">
              <form onSubmit={(event) => void handleSubmit(event)} className="p-5 sm:p-6">
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void handleReferenceFileChange(event)}
                />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.26em] text-zinc-400 dark:text-zinc-500">
                      {hasReferenceImage ? "Image-guided prompt" : "Prompt composer"}
                    </p>
                    {!hasReferenceImage ? (
                      <p
                        className="mt-2 text-[26px] leading-none text-zinc-900 dark:text-white"
                        style={{ fontFamily: titleFont }}
                      >
                        Write the frame you want to see
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    {studioStatus.label}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePickReferenceImage}
                    disabled={isUploadingReference}
                    className="rounded-full bg-black/5 px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-black/10 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/8 dark:text-zinc-200 dark:hover:bg-white/12 dark:hover:text-white"
                  >
                    {isUploadingReference
                      ? "Uploading reference..."
                      : hasReferenceImage
                        ? "Add another reference image"
                        : "Add reference image"}
                  </button>
                  {canvasReferenceImages.length > 1 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Click a reference on the canvas to use it for the next render.
                    </p>
                  ) : null}
                </div>

                {hasReferenceImage ? (
                  <div className="mt-4 flex items-center gap-3 rounded-2xl border border-black/6 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
                    <div className="flex h-16 w-16 items-center justify-center bg-black/5 dark:bg-white/8">
                      <Image
                        src={sourceImageUrl!}
                        alt="Reference image"
                        width={128}
                        height={128}
                        unoptimized
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-zinc-800 dark:text-zinc-100">
                        Reference image
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearReferenceImage}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-zinc-500 transition-colors hover:bg-black/10 hover:text-zinc-900 dark:bg-white/8 dark:text-zinc-300 dark:hover:bg-white/12 dark:hover:text-white"
                      aria-label="Remove reference image"
                      title="Remove reference image"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                ) : null}

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
                    <div className="relative">
                      <label htmlFor="render-aspect-ratio" className="sr-only">
                        Aspect ratio
                      </label>
                      <select
                        id="render-aspect-ratio"
                        value={selectedAspectRatio}
                        onChange={(event) =>
                          setSelectedAspectRatio(event.target.value as AspectRatio)
                        }
                        className="appearance-none rounded-full bg-black/5 px-3 py-2 pr-9 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-black/10 focus:bg-black/10 dark:bg-white/8 dark:text-zinc-200 dark:hover:bg-white/12 dark:focus:bg-white/12"
                      >
                        {ASPECT_RATIO_OPTIONS.map((ratio) => (
                          <option key={ratio.id} value={ratio.id}>
                            {ratio.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                    <div className="relative">
                      <label htmlFor="render-resolution" className="sr-only">
                        Resolution
                      </label>
                      <select
                        id="render-resolution"
                        value={selectedResolution}
                        onChange={(event) =>
                          setSelectedResolution(event.target.value as OutputResolution)
                        }
                        className="appearance-none rounded-full bg-black/5 px-3 py-2 pr-9 text-xs font-medium text-zinc-700 outline-none transition-colors hover:bg-black/10 focus:bg-black/10 dark:bg-white/8 dark:text-zinc-200 dark:hover:bg-white/12 dark:focus:bg-white/12"
                      >
                        {OUTPUT_RESOLUTIONS.map((resolution) => (
                          <option key={resolution.id} value={resolution.id}>
                            {resolution.label}
                          </option>
                        ))}
                      </select>
                      <svg
                        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
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
                          {hasReferenceImage ? "Generate variation" : "Generate image"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

      </main>
    </div>
  );
}
