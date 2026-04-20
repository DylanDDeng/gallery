"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import type { ImagePrompt } from "@/lib/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase-browser";
import UserMenu from "@/components/UserMenu";

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

interface AssetCard {
  id: string;
  imageUrl?: string;
  label: string;
  caption: string;
  kind: "reference" | "result";
  selected?: boolean;
  pending?: boolean;
  onSelect?: () => void;
  onDownload?: () => void;
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

  return `Reference ${index + 1}`;
}

function getPromptExcerpt(text: string, maxLength = 104) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

function formatCreatedAt(value?: string) {
  if (!value) return "Just now";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
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
  const [referenceImages, setReferenceImages] = useState<Partial<ImagePrompt>[]>([]);
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
  }, [checkApiKey, router, selfServiceApiKeysEnabled, user]);

  useEffect(() => {
    if (!user) return;

    if (!isRemixMode) {
      setRemixDraft(null);
      setReferenceImages([]);
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
      setReferenceImages([]);
      setPrompt("");
      return;
    }

    if (draft) {
      setRemixDraft(draft);
      setReferenceImages(
        mergeReferenceImages(
          draft.referenceImages,
          draft.sourceImage?.url ? draft.sourceImage : null
        )
      );
      setPrompt(draft.prompt);
    }
  }, [isRemixMode, searchParams, sourceImageId, user]);

  useEffect(() => {
    if (!isRemixMode || !sourceImageId || !user?.id) {
      setIsRestoringSeries(false);
      return;
    }

    const hydrationRequestId = ++remixHydrationRequestRef.current;
    const draft = readRemixGenerationDraft();
    const snapshot = readRemixContextSnapshot(user.id, sourceImageId);
    const urlDraft = parseGenerationDraftFromSearchParams(
      new URLSearchParams(searchParams.toString())
    );

    const persistedSourceImage =
      snapshot?.sourceImage?.url
        ? snapshot.sourceImage
        : draft?.sourceImage?.url
          ? draft.sourceImage
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
      setReferenceImages(persistedReferenceImages);
      setPrompt(snapshotPrompt);
      setStagedTasks(snapshot.tasks);
    } else {
      setStagedTasks([]);
      setReferenceImages(persistedReferenceImages);
    }

    let isActive = true;

    const hydrateContext = async () => {
      setIsRestoringSeries(true);
      try {
        const context = await fetchRemixContext(sourceImageId);
        const mergedTasks = mergeRemixSeriesItems(snapshot?.tasks, context.tasks);
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

        if (!isActive || remixHydrationRequestRef.current !== hydrationRequestId) {
          return;
        }

        setRemixDraft(nextDraft);
        setReferenceImages(mergedReferenceImages);
        setPrompt(promptFromImage);
        setStagedTasks(mergedTasks);
        saveRemixContextSnapshot(user.id, sourceImageId, {
          sourceImage: nextDraft.sourceImage ?? {},
          referenceImages: mergedReferenceImages,
          tasks: mergedTasks,
          savedAt: Date.now(),
        });
      } catch {
        if (!isActive || remixHydrationRequestRef.current !== hydrationRequestId) {
          return;
        }
      } finally {
        if (!isActive || remixHydrationRequestRef.current !== hydrationRequestId) {
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
      setReferenceImages([]);
      return;
    }

    setReferenceImages(
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
          throw new Error(
            authError.message ||
              "Please sign in again before uploading a reference image."
          );
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
          referenceImages,
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
        setReferenceImages(nextReferenceImages);

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
            returnImageId:
              searchParams.get("returnImageId") || sourceImageId || undefined,
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
      prompt,
      referenceImages,
      returnTo,
      router,
      searchParams,
      sourceImageId,
      stagedTasks,
      user,
    ]
  );

  const handleClearReferenceImage = useCallback(() => {
    const nextReferenceImages = mergeReferenceImages(
      referenceImages,
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

    setReferenceImages(nextReferenceImages);
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
        returnImageId:
          searchParams.get("returnImageId") || sourceImageId || undefined,
      })
    );
  }, [
    referenceImages,
    remixDraft?.sourceImage,
    returnTo,
    router,
    searchParams,
    sourceImageId,
    stagedTasks,
    user?.id,
  ]);

  const handleSelectReferenceImage = useCallback(
    (
      image: Partial<ImagePrompt> & { url: string },
      options?: { skipAddingToReferenceList?: boolean }
    ) => {
      setRemixDraft((previous) => {
        if (!previous) {
          return previous;
        }

        const nextDraft: RemixGenerationDraft = {
          ...previous,
          sourceImageId: previous.sourceImageId ?? sourceImageId ?? undefined,
          sourceImage: image,
          referenceImages: options?.skipAddingToReferenceList
            ? previous.referenceImages
            : mergeReferenceImages(previous.referenceImages, image),
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
          returnImageId:
            searchParams.get("returnImageId") || sourceImageId || undefined,
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
            ? remixDraft?.sourceImageId ?? sourceImageId
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

  const handleDownloadTask = useCallback(
    async (task: { id: string; result_url?: string | null }) => {
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
    },
    [downloadingTaskId]
  );

  const sourceImageUrl = remixDraft?.sourceImage?.url || null;
  const hasReferenceImage = Boolean(sourceImageUrl);
  const creditCount = credits ?? 0;
  const generateDisabled =
    submitting ||
    !prompt.trim() ||
    (selfServiceApiKeysEnabled && !hasApiKey) ||
    (billingEnabled && creditCount < 1);

  const resultTasks = useMemo(() => {
    const rendered = stagedTasks.filter((task) => task.result_url);
    const latest =
      currentTask?.status === "completed" && currentTask.result_url ? currentTask : null;
    return rendered.length > 0 ? rendered : latest ? [latest] : [];
  }, [stagedTasks, currentTask]);

  const resultTaskUrls = useMemo(
    () => new Set(resultTasks.map((task) => task.result_url)),
    [resultTasks]
  );

  const referenceCards = useMemo<AssetCard[]>(
    () =>
      referenceImages
        .filter((image): image is Partial<ImagePrompt> & { url: string } => Boolean(image.url))
        .filter((image) => !resultTaskUrls.has(image.url))
        .map((image, index) => ({
          id: `reference-card:${image.url}`,
          imageUrl: image.url,
          label: getReferenceImageLabel(image, index, sourceImageUrl),
          caption: image.prompt ? getPromptExcerpt(image.prompt, 70) : "Click to use for the next render.",
          kind: "reference" as const,
          selected: image.url === sourceImageUrl,
          onSelect: () => handleSelectReferenceImage(image),
        })),
    [handleSelectReferenceImage, referenceImages, resultTaskUrls, sourceImageUrl]
  );

  const resultCards = useMemo<AssetCard[]>(
    () =>
      [...resultTasks]
        .sort((left, right) => {
          const leftTime = new Date(left.created_at).getTime();
          const rightTime = new Date(right.created_at).getTime();
          return rightTime - leftTime;
        })
        .map((task, index) => ({
        id: task.id,
        imageUrl: task.result_url!,
        label: index === 0 ? "Latest render" : `Variation ${index}`,
        caption: `${formatCreatedAt(task.created_at)} · ${task.model}`,
        kind: "result" as const,
        selected: task.result_url === sourceImageUrl,
        onDownload: () => {
          void handleDownloadTask(task);
        },
        onSelect: () => {
          handleSelectReferenceImage(
            {
              url: task.result_url!,
              prompt: task.prompt,
            },
            { skipAddingToReferenceList: true }
          );
        },
      })),
    [handleDownloadTask, handleSelectReferenceImage, resultTasks, sourceImageUrl]
  );

  const pendingCard = useMemo<AssetCard | null>(
    () =>
      submitting
        ? {
            id: "pending-render",
            label: "Rendering next image",
            caption: "The new output will appear here as soon as it completes.",
            kind: "result" as const,
            pending: true,
          }
        : null,
    [submitting]
  );

  const featuredAsset =
    pendingCard ?? resultCards.find((asset) => asset.selected) ?? resultCards[0] ?? null;
  const resultCount = resultCards.length;

  if (!user) {
    return null;
  }

  const generateLabel = submitting
    ? "Rendering…"
    : hasReferenceImage
      ? "Generate variation"
      : "Generate image";

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="flex select-none items-center gap-3"
            >
              <img src="/logo.png" alt="" className="h-8 w-8" />
              <h1
                className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                Aestara
              </h1>
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
            <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              Remix studio
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {billingEnabled ? (
              <button
                type="button"
                onClick={() => router.push((credits ?? 0) > 0 ? "/credits" : "/pricing")}
                className="hidden sm:inline-flex h-9 items-center rounded-lg px-3 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {credits ?? "—"} credits
              </button>
            ) : null}
            <UserMenu />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="lg:sticky lg:top-[77px] lg:self-start rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 p-4"
          >
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => void handleReferenceFileChange(event)}
            />

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  References
                </span>
                <button
                  type="button"
                  onClick={handlePickReferenceImage}
                  disabled={isUploadingReference}
                  className="text-xs text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {isUploadingReference ? "Uploading…" : "+ Add"}
                </button>
              </div>
              {referenceCards.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {referenceCards.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={asset.onSelect}
                      title={asset.label}
                      className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg ring-1 transition-all ${
                        asset.selected
                          ? "ring-2 ring-zinc-900 dark:ring-white"
                          : "ring-zinc-200 hover:ring-zinc-300 dark:ring-white/10 dark:hover:ring-white/20"
                      }`}
                    >
                      {asset.imageUrl ? (
                        <Image
                          src={asset.imageUrl}
                          alt={asset.label}
                          width={160}
                          height={160}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-400 dark:border-white/10 dark:text-zinc-500">
                  No references staged
                </div>
              )}
              {hasReferenceImage ? (
                <button
                  type="button"
                  onClick={handleClearReferenceImage}
                  className="mt-2 text-xs text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  Clear active reference
                </button>
              ) : null}
            </div>

            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Prompt
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-600">
                  {prompt.length}/10000
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the image you want to generate…"
                rows={8}
                className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm leading-6 text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:focus:border-white/25"
              />
            </div>

            <div className="mb-4 space-y-3">
              <div>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Model
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MODELS.map((model) => {
                    const isActive = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => setSelectedModel(model.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                        }`}
                      >
                        {model.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Aspect ratio
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ASPECT_RATIO_OPTIONS.map((ratio) => {
                    const isActive = selectedAspectRatio === ratio.id;
                    return (
                      <button
                        key={ratio.id}
                        type="button"
                        onClick={() => setSelectedAspectRatio(ratio.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                        }`}
                      >
                        {ratio.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  Resolution
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {OUTPUT_RESOLUTIONS.map((resolution) => {
                    const isActive = selectedResolution === resolution.id;
                    return (
                      <button
                        key={resolution.id}
                        type="button"
                        onClick={() => setSelectedResolution(resolution.id)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          isActive
                            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-white/5 dark:text-zinc-400 dark:hover:bg-white/10"
                        }`}
                      >
                        {resolution.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selfServiceApiKeysEnabled && hasApiKey === false ? (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                Configure your Doubao API key in{" "}
                <button
                  type="button"
                  onClick={() => router.push("/settings")}
                  className="underline underline-offset-2"
                >
                  Settings
                </button>{" "}
                before rendering.
              </div>
            ) : null}

            {error ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={generateDisabled}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              {submitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white dark:border-zinc-900/30 dark:border-t-zinc-900" />
              ) : null}
              {generateLabel}
            </button>
          </form>

          <section className="min-w-0 rounded-2xl border border-zinc-200 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                Generated images
              </h2>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {resultCount} renders
              </span>
            </div>

            {featuredAsset ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex min-h-[320px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-zinc-100 p-3 dark:bg-zinc-800/50 sm:p-4">
                    {featuredAsset.pending || !featuredAsset.imageUrl ? (
                      <div className="flex aspect-[4/5] items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-400 dark:border-zinc-700 dark:border-t-zinc-500" />
                      </div>
                    ) : (
                      <Image
                        src={featuredAsset.imageUrl}
                        alt={featuredAsset.label}
                        width={1200}
                        height={1500}
                        unoptimized
                        className="max-h-[calc(100vh-180px)] w-auto max-w-full object-contain"
                      />
                    )}
                    {featuredAsset.kind === "result" && featuredAsset.onDownload ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          featuredAsset.onDownload?.();
                        }}
                        className="absolute bottom-3 right-3 rounded-md bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                      >
                        {downloadingTaskId === featuredAsset.id ? "Saving…" : "Download"}
                      </button>
                    ) : null}
                  </div>

                  {resultCards.length > 1 ? (
                    <div className="flex max-h-[calc(100vh-180px)] flex-row gap-2 overflow-x-auto rounded-xl bg-zinc-100/80 p-2 dark:bg-zinc-900/50 sm:w-[88px] sm:flex-col sm:overflow-x-visible sm:overflow-y-auto">
                      {resultCards.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={asset.onSelect}
                        title={asset.label}
                        className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg transition-all sm:h-[72px] sm:w-[72px] ${
                          asset.id === featuredAsset.id
                            ? "ring-2 ring-zinc-900 dark:ring-white scale-[1.02]"
                            : "ring-1 ring-zinc-200 hover:ring-zinc-300 dark:ring-white/10 dark:hover:ring-white/20"
                        }`}
                      >
                        <Image
                          src={asset.imageUrl!}
                          alt={asset.label}
                          width={320}
                          height={320}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="flex aspect-[4/5] max-h-[640px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 px-6 text-center dark:border-white/10">
                <svg
                  className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {isRestoringSeries ? "Restoring saved variations…" : "No images yet"}
                </p>
                {!isRestoringSeries ? (
                  <p className="mt-1 max-w-xs text-xs text-zinc-400 dark:text-zinc-500">
                    Describe what you want on the left, then click Generate.
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
