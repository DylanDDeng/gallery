"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { formatDate } from "@/lib/format";
import { translateError } from "@/lib/translate-error";
import type { Locale } from "@/i18n/routing";
import { isBillingEnabled } from "@/lib/billing-feature";
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
import {
  DEFAULT_MODEL_ID,
  MODEL_OPTIONS,
  buildGptImageTierId,
  getDefaultTierId,
  getGenerationCreditsCost,
  getGptImageOrientationOptions,
  getGptImageQualityOptions,
  getModelPricing,
  getResolutionCreditsLabel,
  getTierCreditsLabel,
  isGptImageModel,
  modelUsesAspectRatio,
  parseGptImageTierId,
  type GptImageOrientation,
  type GptImageQuality,
} from "@/lib/model-pricing";
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
  onRemove?: () => void;
  onDownload?: () => void;
  onUseAsReference?: () => void;
}

const REFERENCE_IMAGE_BUCKET = "generations";
const MAX_REFERENCE_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_REFERENCE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

function isGifReferenceUrl(url?: string | null) {
  if (!url) {
    return false;
  }

  return /\.gif(?:$|[?#])/i.test(url);
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

function normalizeSeriesItem(
  task: Partial<RemixSeriesItem> & { id: string }
): RemixSeriesItem | null {
  if (!task.result_url || typeof task.result_url !== "string") {
    return null;
  }

  return {
    id: task.id,
    result_url: task.result_url,
    prompt: task.prompt ?? "",
    model: task.model ?? DEFAULT_MODEL_ID,
    created_at: task.created_at ?? new Date().toISOString(),
    source_image_id: task.source_image_id,
  };
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

function removeReferenceImage(
  images: Partial<ImagePrompt>[],
  imageUrl: string
) {
  return images.filter((image) => image.url?.trim() !== imageUrl);
}

function getPromptExcerpt(text: string, maxLength = 104) {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export default function GeneratePage() {
  const t = useTranslations("generate");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useAppStore((s) => s.user);
  const authInitialized = useAppStore((s) => s.authInitialized);
  const setShowLoginPrompt = useAppStore((s) => s.setShowLoginPrompt);
  const credits = useAppStore((s) => s.credits);
  const setCredits = useAppStore((s) => s.setCredits);
  const fetchCredits = useAppStore((s) => s.fetchCredits);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const openGallery = useAppStore((s) => s.openGallery);
  const billingEnabled = isBillingEnabled();
  const isRemixMode = searchParams.get("mode") === "remix";
  const sourceImageId = searchParams.get("sourceImageId");
  const returnTo = searchParams.get("returnTo") ?? "gallery";

  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentTask, setCurrentTask] = useState<GenerationTask | null>(null);
  const [stagedTasks, setStagedTasks] = useState<RemixSeriesItem[]>([]);
  const [historyTasks, setHistoryTasks] = useState<RemixSeriesItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [featuredTaskId, setFeaturedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remixDraft, setRemixDraft] = useState<RemixGenerationDraft | null>(null);
  const [referenceImages, setReferenceImages] = useState<Partial<ImagePrompt>[]>([]);
  const [isRestoringSeries, setIsRestoringSeries] = useState(false);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [downloadingTaskId, setDownloadingTaskId] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [selectedResolution, setSelectedResolution] = useState<OutputResolution>("2K");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("1:1");
  const [selectedGptQuality, setSelectedGptQuality] = useState<GptImageQuality>("medium");
  const [selectedGptOrientation, setSelectedGptOrientation] =
    useState<GptImageOrientation>("square");
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const remixHydrationRequestRef = useRef(0);
  const historyRequestRef = useRef(0);
  const usesAspectRatio = modelUsesAspectRatio(selectedModel);
  const selectedOutputSize = usesAspectRatio
    ? getOutputSize(selectedResolution, selectedAspectRatio)
    : null;
  const activeTierId = usesAspectRatio
    ? selectedResolution
    : buildGptImageTierId(selectedGptQuality, selectedGptOrientation);
  const selectedCreditsCost = getGenerationCreditsCost(selectedModel, activeTierId) ?? 0;
  const selectedModelPricing = getModelPricing(selectedModel);
  const referenceAcceptTypes = isGptImageModel(selectedModel)
    ? "image/png,image/jpeg,image/webp"
    : "image/png,image/jpeg,image/webp,image/gif";

  const fetchRemixContext = useCallback(
    async (nextSourceImageId: string) => {
      const res = await fetch(
        `/api/generations/remix-context?sourceImageId=${encodeURIComponent(nextSourceImageId)}`
      );
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || t("errors.failedRemixContext"));
      }

      return {
        sourceImage: json.sourceImage as ImagePrompt,
        tasks: Array.isArray(json.tasks) ? (json.tasks as RemixSeriesItem[]) : [],
      };
    },
    [t]
  );

  useEffect(() => {
    if (!authInitialized || user) {
      return;
    }

    setShowLoginPrompt(true, "generate");
  }, [authInitialized, setShowLoginPrompt, user]);

  useEffect(() => {
    setHistoryTasks([]);
    setFeaturedTaskId(null);
    historyRequestRef.current += 1;
  }, [user?.id]);

  useEffect(() => {
    if (!isRemixMode) {
      setStagedTasks([]);
      return;
    }

    setFeaturedTaskId(null);
  }, [isRemixMode]);

  useEffect(() => {
    if (isRemixMode || !user?.id) {
      return;
    }

    const requestId = ++historyRequestRef.current;

    setHistoryTasks((previous) => {
      if (previous.length === 0) {
        setIsLoadingHistory(true);
      }
      return previous;
    });

    const loadHistory = async () => {
      try {
        const res = await fetch("/api/generations?status=completed&limit=20");
        const json = await res.json();

        if (historyRequestRef.current !== requestId) {
          return;
        }

        if (!res.ok) {
          return;
        }

        const tasks = (Array.isArray(json.data) ? json.data : [])
          .map((task: Partial<RemixSeriesItem> & { id: string }) => normalizeSeriesItem(task))
          .filter((task: RemixSeriesItem | null): task is RemixSeriesItem => task !== null);

        setHistoryTasks((previous) => mergeRemixSeriesItems(previous, tasks));
      } catch {
        // Keep the page usable when history loading fails.
      } finally {
        if (historyRequestRef.current === requestId) {
          setIsLoadingHistory(false);
        }
      }
    };

    void loadHistory();
  }, [isRemixMode, user?.id]);

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
        setError(t("errors.chooseImageFile"));
        return;
      }

      if (!ALLOWED_REFERENCE_MIME_TYPES.has(file.type)) {
        setError(t("errors.uploadFormats"));
        return;
      }

      if (isGptImageModel(selectedModel) && file.type === "image/gif") {
        setError(t("errors.gptNoGif"));
        return;
      }

      if (file.size > MAX_REFERENCE_UPLOAD_BYTES) {
        setError(t("errors.maxFileSize"));
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
            authError.message || t("errors.signInToUpload")
          );
        }

        if (!authUser) {
          throw new Error(t("errors.signInToUpload"));
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
          throw new Error(uploadError.message || t("errors.failedToUpload"));
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
            ? t("errors.uploadUnauthorized")
            : uploadError instanceof Error
              ? uploadError.message
              : t("errors.uploadRetry")
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
      t,
      user,
    ]
  );

  const handleRemoveReferenceImage = useCallback(
    (image: Partial<ImagePrompt> & { url: string }) => {
      const activeSourceImageUrl = remixDraft?.sourceImage?.url ?? null;
      const isRemovingActive = activeSourceImageUrl === image.url;
      const nextReferenceImages = removeReferenceImage(referenceImages, image.url);
      const nextSourceImage = isRemovingActive ? undefined : remixDraft?.sourceImage;
      const nextSourceImageId = remixDraft?.sourceImageId ?? sourceImageId ?? undefined;

      if (user?.id && nextSourceImageId) {
        saveRemixContextSnapshot(user.id, nextSourceImageId, {
          sourceImage: nextSourceImage ?? {},
          referenceImages: nextReferenceImages,
          tasks: stagedTasks,
          savedAt: Date.now(),
        });
      }

      setReferenceImages(nextReferenceImages);
      setRemixDraft((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          sourceImageId: previous.sourceImageId ?? sourceImageId ?? undefined,
          sourceImage:
            previous.sourceImage?.url === image.url ? undefined : previous.sourceImage,
          referenceImages: nextReferenceImages,
        };
      });

      router.replace(
        buildRemixGenerateUrl({
          sourceImageId: sourceImageId || undefined,
          sourceImageUrl: isRemovingActive ? undefined : activeSourceImageUrl ?? undefined,
          returnTo: returnTo === "original" ? "original" : "gallery",
          returnImageId:
            searchParams.get("returnImageId") || sourceImageId || undefined,
        })
      );
    },
    [
      referenceImages,
      remixDraft?.sourceImage,
      remixDraft?.sourceImageId,
      returnTo,
      router,
      searchParams,
      sourceImageId,
      stagedTasks,
      user?.id,
    ]
  );

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

  const handleUseAsReference = useCallback(
    (task: RemixSeriesItem) => {
      const nextSourceImage = {
        url: task.result_url,
        prompt: task.prompt,
      };

      setStagedTasks([]);
      setFeaturedTaskId(null);

      saveRemixGenerationDraft({
        mode: "remix",
        prompt: task.prompt,
        promptLang: "en",
        sourceImage: nextSourceImage,
        referenceImages: [nextSourceImage],
        returnTo: "gallery",
        createdAt: Date.now(),
      });

      router.replace(
        buildRemixGenerateUrl({
          sourceImageUrl: task.result_url,
          sourcePrompt: task.prompt,
          returnTo: "gallery",
        })
      );
    },
    [router]
  );

  const handleModelChange = useCallback((nextModel: typeof selectedModel) => {
    setSelectedModel(nextModel);
    const defaultTierId = getDefaultTierId(nextModel);

    if (modelUsesAspectRatio(nextModel)) {
      setSelectedResolution(defaultTierId === "3K" ? "3K" : "2K");
      return;
    }

    const parsedTier = parseGptImageTierId(defaultTierId);
    if (parsedTier) {
      setSelectedGptQuality(parsedTier.quality);
      setSelectedGptOrientation(parsedTier.orientation);
    }

    const hadGifReference =
      referenceImages.some((image) => isGifReferenceUrl(image.url)) ||
      isGifReferenceUrl(remixDraft?.sourceImage?.url) ||
      (remixDraft?.referenceImages ?? []).some((image) =>
        isGifReferenceUrl(image.url)
      );

    setReferenceImages((previous) =>
      previous.filter((image) => !isGifReferenceUrl(image.url))
    );
    setRemixDraft((previous) => {
      if (!previous) {
        return previous;
      }

      const nextReferenceImages = (previous.referenceImages ?? []).filter(
        (image) => !isGifReferenceUrl(image.url)
      );
      const nextSourceImage =
        previous.sourceImage?.url && isGifReferenceUrl(previous.sourceImage.url)
          ? undefined
          : previous.sourceImage;

      if (
        nextReferenceImages.length === (previous.referenceImages ?? []).length &&
        nextSourceImage === previous.sourceImage
      ) {
        return previous;
      }

      return {
        ...previous,
        sourceImage: nextSourceImage,
        referenceImages: nextReferenceImages,
      };
    });

    if (hadGifReference) {
      setError(t("errors.gifRemoved"));
    }
  }, [referenceImages, remixDraft, t]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!prompt.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setCurrentTask(null);

    if (!isRemixMode) {
      setFeaturedTaskId(null);
    }

    const shouldOptimisticallyDeduct =
      billingEnabled && typeof credits === "number" && credits >= selectedCreditsCost;

    console.info(CREDITS_DEBUG_PREFIX, "generate:submit:start", {
      mode: isRemixMode ? "remix" : "new",
      credits,
      shouldOptimisticallyDeduct,
      activeTierId,
      selectedAspectRatio,
      selectedCreditsCost,
      outputSize: selectedOutputSize?.size ?? null,
      selectedModel,
    });

    if (shouldOptimisticallyDeduct) {
      setCredits(credits - selectedCreditsCost);
    }

    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel,
          tierId: activeTierId,
          resolution: usesAspectRatio ? selectedResolution : undefined,
          aspectRatio: usesAspectRatio ? selectedAspectRatio : undefined,
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
        setError(
          translateError(tErrors, json.errorCode, json.error) ||
            t("errors.failedToCreate"),
        );
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
        const completedTask = normalizeSeriesItem(json.task);
        if (completedTask) {
          setHistoryTasks((previous) =>
            mergeRemixSeriesItems(previous, [completedTask])
          );
        }
        setPrompt("");
      }
    } catch (submitError) {
      console.error(CREDITS_DEBUG_PREFIX, "generate:submit:exception", submitError);
      if (billingEnabled && shouldOptimisticallyDeduct) {
        await fetchCredits();
      }
      console.error("Error creating generation:", submitError);
      setError(t("errors.genericError"));
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
        link.download = `${isRemixMode ? "remix" : "render"}-${task.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(objectUrl);
      } catch (downloadError) {
        console.error("Error downloading generated image:", downloadError);
        setError(t("errors.failedToDownload"));
      } finally {
        setDownloadingTaskId((current) => (current === task.id ? null : current));
      }
    },
    [downloadingTaskId, isRemixMode, t]
  );

  const sourceImageUrl = remixDraft?.sourceImage?.url || null;
  const hasReferenceImage = Boolean(sourceImageUrl);
  const creditCount = credits ?? 0;
  const generateDisabled =
    !user ||
    submitting ||
    !prompt.trim() ||
    (billingEnabled && (selectedCreditsCost <= 0 || creditCount < selectedCreditsCost));

  const resultTasks = useMemo(() => {
    if (!isRemixMode) {
      return historyTasks;
    }

    const rendered = stagedTasks
      .map((task) => normalizeSeriesItem(task))
      .filter((task): task is RemixSeriesItem => task !== null);
    const latest =
      currentTask?.status === "completed" && currentTask.result_url
        ? normalizeSeriesItem(currentTask)
        : null;
    return rendered.length > 0 ? rendered : latest ? [latest] : [];
  }, [currentTask, historyTasks, isRemixMode, stagedTasks]);

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
          label:
            image.url === sourceImageUrl
              ? t("currentReference")
              : t("referenceLabel", { index: index + 1 }),
          caption: image.prompt
            ? getPromptExcerpt(image.prompt, 70)
            : t("referenceCaption"),
          kind: "reference" as const,
          selected: image.url === sourceImageUrl,
          onSelect: () => handleSelectReferenceImage(image),
          onRemove: () => handleRemoveReferenceImage(image),
        })),
    [
      handleRemoveReferenceImage,
      handleSelectReferenceImage,
      referenceImages,
      resultTaskUrls,
      sourceImageUrl,
      t,
    ]
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
          imageUrl: task.result_url,
          label: isRemixMode
            ? index === 0
              ? t("latestPrint")
              : t("variation", { index })
            : index === 0
              ? t("latestPrint")
              : t("print", { index }),
          caption: `${formatDate(task.created_at, locale)} · ${
            getModelPricing(task.model).name
          }`,
          kind: "result" as const,
          selected: isRemixMode
            ? task.result_url === sourceImageUrl
            : task.id === featuredTaskId,
          onDownload: () => {
            void handleDownloadTask(task);
          },
          onSelect: isRemixMode
            ? () => {
                handleSelectReferenceImage(
                  {
                    url: task.result_url!,
                    prompt: task.prompt,
                  },
                  { skipAddingToReferenceList: true }
                );
              }
            : () => {
                setFeaturedTaskId(task.id);
              },
          onUseAsReference: isRemixMode
            ? undefined
            : () => {
                handleUseAsReference(task);
              },
        })),
    [
      featuredTaskId,
      handleDownloadTask,
      handleSelectReferenceImage,
      handleUseAsReference,
      isRemixMode,
      locale,
      resultTasks,
      sourceImageUrl,
      t,
    ]
  );

  const pendingCard = useMemo<AssetCard | null>(
    () =>
      submitting
        ? {
            id: "pending-render",
            label: t("developingNextPrint"),
            caption: t("pendingCaption"),
            kind: "result" as const,
            pending: true,
          }
        : null,
    [submitting, t]
  );

  const featuredAsset = isRemixMode
    ? (resultCards.find((asset) => asset.selected) ??
      resultCards[0] ??
      pendingCard ??
      null)
    : (pendingCard ??
      resultCards.find((asset) => asset.id === featuredTaskId) ??
      resultCards[0] ??
      null);
  const thumbnailCards = pendingCard ? [...resultCards, pendingCard] : resultCards;
  const resultCount = resultCards.length + (pendingCard ? 1 : 0);

  const generateLabel = submitting
    ? t("developing")
    : hasReferenceImage
      ? t("developVariation", { credits: selectedCreditsCost })
      : t("developPrint", { credits: selectedCreditsCost });

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#2a2520] dark:bg-[#0c0b09] dark:text-[#c4bdb4]">
      <header className="sticky top-0 z-40 border-b border-[#d5cfc4] bg-[#f5f2ed]/80 backdrop-blur-md dark:border-[#2a2520] dark:bg-[#0c0b09]/80">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => {
                openGallery();
                router.push("/");
              }}
              className="flex select-none items-center gap-3"
            >
              <h1
                className="text-2xl font-bold tracking-tight text-[#2a2520] dark:text-[#c4bdb4]"
                style={{ fontFamily: "'Caveat', cursive" }}
              >
                {tCommon("brand")}
              </h1>
            </button>
            <span className="hidden items-center gap-2 sm:flex">
              <span className="text-[#a39b90] dark:text-[#5c564e]">·</span>
              <span className="text-[11px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                {isRemixMode ? t("remixStudio") : t("studio")}
              </span>
            </span>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => {
                openGallery();
                router.push("/");
              }}
              className="hidden text-[11px] uppercase tracking-[0.15em] text-[#8a837a] transition-colors hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:text-[#c4bdb4] md:block"
            >
              {tNav("gallery")}
            </button>
            {billingEnabled ? (
              <button
                type="button"
                onClick={() => router.push("/credits")}
                className="hidden text-[11px] uppercase tracking-[0.15em] text-[#8a837a] transition-colors hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:text-[#c4bdb4] sm:block"
              >
                {tCommon("creditsDisplay", { count: credits ?? 0 })}
              </button>
            ) : null}
            <LanguageSwitcher />
            <UserMenu />
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={tCommon("toggleTheme")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#8a837a] transition-colors hover:bg-[#e8e4de] hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:bg-[#1a1814] dark:hover:text-[#c4bdb4]"
            >
              {theme === "light" ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-6 pb-16 pt-10">
        <div className="grid gap-10 lg:grid-cols-[360px_1px_minmax(0,1fr)] lg:gap-12">
          <form
            onSubmit={(event) => void handleSubmit(event)}
            className="lg:sticky lg:top-[89px] lg:self-start"
          >
            <input
              ref={referenceInputRef}
              type="file"
              accept={referenceAcceptTypes}
              className="hidden"
              onChange={(event) => void handleReferenceFileChange(event)}
            />

            <div className="border-b border-[#d5cfc4] pb-6 dark:border-[#2a2520]">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                  {t("negatives")}
                </span>
                <button
                  type="button"
                  onClick={handlePickReferenceImage}
                  disabled={isUploadingReference}
                  className="text-[11px] uppercase tracking-[0.15em] text-[#8a837a] underline decoration-[#d5cfc4] underline-offset-4 transition-colors hover:text-[#2a2520] hover:decoration-[#8a837a] disabled:opacity-50 dark:text-[#5c564e] dark:decoration-[#3a352f] dark:hover:text-[#c4bdb4]"
                >
                  {isUploadingReference ? t("loading") : t("load")}
                </button>
              </div>
              {referenceCards.length > 0 ? (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {referenceCards.map((asset) => (
                    <div key={asset.id} className="group relative h-[72px] w-[72px] flex-shrink-0">
                      <button
                        type="button"
                        onClick={asset.onSelect}
                        title={asset.label}
                        className={`h-full w-full overflow-hidden transition-all ${
                          asset.selected
                            ? "ring-1 ring-[#2a2520] ring-offset-2 ring-offset-[#f5f2ed] dark:ring-[#c4bdb4] dark:ring-offset-[#0c0b09]"
                            : "opacity-70 ring-1 ring-[#d5cfc4] hover:opacity-100 dark:ring-[#3a352f]"
                        }`}
                      >
                        {asset.imageUrl ? (
                          <Image
                            src={asset.imageUrl}
                            alt={asset.label}
                            width={144}
                            height={144}
                            unoptimized
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </button>
                      {asset.onRemove ? (
                        <button
                          type="button"
                          onClick={asset.onRemove}
                          aria-label={t("removeReference", { label: asset.label })}
                          title={t("removeReference", { label: asset.label })}
                          className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f2ed] text-[#8a837a] opacity-0 ring-1 ring-[#d5cfc4] transition-all hover:text-[#2a2520] focus-visible:opacity-100 group-hover:opacity-100 dark:bg-[#0c0b09] dark:text-[#5c564e] dark:ring-[#3a352f] dark:hover:text-[#c4bdb4]"
                        >
                          <svg className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
                            <path d="M5 5l10 10M15 5L5 15" strokeWidth="2.4" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] italic text-[#8a837a] dark:text-[#5c564e]" style={{ fontFamily: "'Instrument Serif', serif" }}>
                  {t("noNegatives")}
                </p>
              )}
            </div>

            <div className="border-b border-[#d5cfc4] py-6 dark:border-[#2a2520]">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                  {t("exposureNotes")}
                </span>
                <span className="text-[10px] tabular-nums text-[#a39b90] dark:text-[#4a443c]">
                  {t("promptCounter", { current: prompt.length })}
                </span>
              </div>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder={t("promptPlaceholder")}
                rows={8}
                className="w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-7 text-[#2a2520] outline-none placeholder:italic placeholder:text-[#a39b90] dark:text-[#c4bdb4] dark:placeholder:text-[#4a443c]"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              />
            </div>

            <div className="space-y-5 border-b border-[#d5cfc4] py-6 dark:border-[#2a2520]">
              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                  {t("filmStock")}
                </span>
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                  {MODEL_OPTIONS.map((model) => {
                    const isActive = selectedModel === model.id;
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => handleModelChange(model.id)}
                        className={`text-[12px] tracking-wide transition-colors ${
                          isActive
                            ? "text-[#2a2520] underline decoration-[#2a2520] underline-offset-[6px] dark:text-[#c4bdb4] dark:decoration-[#c4bdb4]"
                            : "text-[#8a837a] hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:text-[#c4bdb4]"
                        }`}
                      >
                        {model.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {usesAspectRatio ? (
                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                    {t("frame")}
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {ASPECT_RATIO_OPTIONS.map((ratio) => {
                      const isActive = selectedAspectRatio === ratio.id;
                      const [w, h] = ratio.id.split(":").map(Number);
                      const scale = 15 / Math.max(w, h);
                      return (
                        <button
                          key={ratio.id}
                          type="button"
                          onClick={() => setSelectedAspectRatio(ratio.id)}
                          title={ratio.label}
                          className={`flex h-[52px] w-[46px] flex-col items-center justify-between pb-1 pt-2.5 transition-colors ${
                            isActive ? "bg-[#ebe7e0] dark:bg-[#1a1814]" : "hover:bg-[#ebe7e0]/60 dark:hover:bg-[#1a1814]/50"
                          }`}
                        >
                          <span
                            className={`block border transition-colors ${
                              isActive ? "border-[#2a2520] dark:border-[#c4bdb4]" : "border-[#a39b90] dark:border-[#5c564e]"
                            }`}
                            style={{
                              width: `${Math.max(w * scale, 5)}px`,
                              height: `${Math.max(h * scale, 5)}px`,
                            }}
                          />
                          <span
                            className={`text-[9px] tracking-wide ${
                              isActive ? "text-[#2a2520] dark:text-[#c4bdb4]" : "text-[#8a837a] dark:text-[#5c564e]"
                            }`}
                          >
                            {ratio.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                    {t("orientation")}
                  </span>
                  <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                    {getGptImageOrientationOptions().map((orientation) => {
                      const isActive = selectedGptOrientation === orientation.id;
                      return (
                        <button
                          key={orientation.id}
                          type="button"
                          onClick={() => setSelectedGptOrientation(orientation.id)}
                          className={`text-[12px] tracking-wide transition-colors ${
                            isActive
                              ? "text-[#2a2520] underline decoration-[#2a2520] underline-offset-[6px] dark:text-[#c4bdb4] dark:decoration-[#c4bdb4]"
                              : "text-[#8a837a] hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:text-[#c4bdb4]"
                          }`}
                        >
                          {orientation.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                  {usesAspectRatio ? t("paperSize") : t("quality")}
                </span>
                <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
                  {usesAspectRatio
                    ? OUTPUT_RESOLUTIONS.map((resolution) => {
                        const isActive = selectedResolution === resolution.id;
                        return (
                          <button
                            key={resolution.id}
                            type="button"
                            onClick={() => setSelectedResolution(resolution.id)}
                            className={`text-[12px] tracking-wide transition-colors ${
                              isActive
                                ? "text-[#2a2520] underline decoration-[#2a2520] underline-offset-[6px] dark:text-[#c4bdb4] dark:decoration-[#c4bdb4]"
                                : "text-[#8a837a] hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:text-[#c4bdb4]"
                            }`}
                          >
                            {getResolutionCreditsLabel(selectedModel, resolution.id)}
                          </button>
                        );
                      })
                    : getGptImageQualityOptions().map((quality) => {
                        const isActive = selectedGptQuality === quality.id;
                        const tierId = buildGptImageTierId(
                          quality.id,
                          selectedGptOrientation
                        );
                        return (
                          <button
                            key={quality.id}
                            type="button"
                            onClick={() => setSelectedGptQuality(quality.id)}
                            className={`text-[12px] tracking-wide transition-colors ${
                              isActive
                                ? "text-[#2a2520] underline decoration-[#2a2520] underline-offset-[6px] dark:text-[#c4bdb4] dark:decoration-[#c4bdb4]"
                                : "text-[#8a837a] hover:text-[#2a2520] dark:text-[#5c564e] dark:hover:text-[#c4bdb4]"
                            }`}
                          >
                            {getTierCreditsLabel(selectedModel, tierId)}
                          </button>
                        );
                      })}
                </div>
              </div>
            </div>

            {error ? (
              <p className="pt-5 text-[12px] leading-5 text-red-600 dark:text-red-300">{error}</p>
            ) : null}

            <div className="pt-6">
              <button
                type="submit"
                disabled={generateDisabled}
                className="flex w-full items-center justify-center gap-3 bg-[#2a2520] px-4 py-3.5 text-[11px] font-medium uppercase tracking-[0.25em] text-[#f5f2ed] transition-colors hover:bg-[#3a352f] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#c4bdb4] dark:text-[#141210] dark:hover:bg-[#d5cfc4]"
              >
                {submitting ? (
                  <span className="studio-pulse h-1.5 w-1.5 rounded-full bg-[#f5f2ed] dark:bg-[#141210]" />
                ) : null}
                {generateLabel}
              </button>
              <p className="mt-3 text-center text-[10px] tracking-wide text-[#a39b90] dark:text-[#4a443c]">
                {t("creditsPerPrint", {
                  model: selectedModelPricing.name,
                  credits: selectedCreditsCost,
                })}
              </p>
            </div>
          </form>

          <div className="hidden bg-[#d5cfc4] dark:bg-[#2a2520] lg:block" />
          <section className="min-w-0">
            {featuredAsset ? (
              <div className="flex flex-col gap-8">
                <div className="studio-backdrop flex min-h-[420px] items-center justify-center px-4 py-10 sm:px-10 lg:min-h-[calc(100vh-330px)]">
                  <figure className="max-w-full">
                    <div className="bg-[#faf8f5] p-2.5 pb-9 shadow-[0_20px_60px_rgba(42,37,32,0.12)] sm:p-3 sm:pb-11 dark:bg-[#f2ece2] dark:shadow-[0_24px_70px_rgba(0,0,0,0.45)]">
                      {featuredAsset.pending || !featuredAsset.imageUrl ? (
                        <div className="relative h-[420px] w-[336px] max-w-full overflow-hidden bg-[#e8e4de] dark:bg-[#1a1614]">
                          <div
                            className="absolute inset-0 bg-gradient-to-br from-[#d5cfc4] via-[#e8e4de] to-[#d5cfc4] dark:from-[#241f1b] dark:via-[#38302a] dark:to-[#241f1b]"
                            style={{ animation: "photo-develop 3s ease-in-out infinite" }}
                          />
                          <div
                            className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2a2520]/20 to-transparent dark:via-[#c4bdb4]/30"
                            style={{ animation: "scan-line 2s ease-in-out infinite" }}
                          />
                        </div>
                      ) : (
                        <Image
                          src={featuredAsset.imageUrl}
                          alt={featuredAsset.label}
                          width={1200}
                          height={1500}
                          unoptimized
                          className="max-h-[calc(100vh-420px)] min-h-[280px] w-auto max-w-full object-contain"
                        />
                      )}
                      <figcaption
                        className="mt-3 flex items-baseline justify-between gap-4 px-1 text-[11px] italic text-[#8a837a] dark:text-[#5c564e]"
                        style={{ fontFamily: "'Instrument Serif', serif" }}
                      >
                        <span className="truncate">
                          {featuredAsset.pending ? t("developing") : featuredAsset.label}
                        </span>
                        {!featuredAsset.pending ? (
                          <span className="flex-shrink-0">{featuredAsset.caption}</span>
                        ) : null}
                      </figcaption>
                    </div>
                    {featuredAsset.kind === "result" &&
                    (featuredAsset.onDownload || featuredAsset.onUseAsReference) ? (
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
                        {!isRemixMode && featuredAsset.onUseAsReference ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              featuredAsset.onUseAsReference?.();
                            }}
                            className="text-[11px] uppercase tracking-[0.2em] text-[#8a837a] underline decoration-[#d5cfc4] underline-offset-4 transition-colors hover:text-[#2a2520] hover:decoration-[#8a837a] dark:text-[#5c564e] dark:decoration-[#3a352f] dark:hover:text-[#c4bdb4]"
                          >
                            {t("useAsReference")}
                          </button>
                        ) : null}
                        {featuredAsset.onDownload ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              featuredAsset.onDownload?.();
                            }}
                            className="text-[11px] uppercase tracking-[0.2em] text-[#8a837a] underline decoration-[#d5cfc4] underline-offset-4 transition-colors hover:text-[#2a2520] hover:decoration-[#8a837a] dark:text-[#5c564e] dark:decoration-[#3a352f] dark:hover:text-[#c4bdb4]"
                          >
                            {downloadingTaskId === featuredAsset.id
                              ? tCommon("saving")
                              : t("downloadPrint")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </figure>
                </div>

                {thumbnailCards.length > 1 ? (
                  <div>
                    <div className="mb-3 flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-[0.25em] text-[#8a837a] dark:text-[#5c564e]">
                        {t("contactSheet")}
                      </span>
                      <span className="text-[10px] tabular-nums tracking-wide text-[#a39b90] dark:text-[#4a443c]">
                        {t("framesCount", { count: resultCount })}
                      </span>
                    </div>
                    <div className="film-strip overflow-x-auto">
                      <div className="flex gap-3">
                        {thumbnailCards.map((asset, index) => {
                          const frameNumber = asset.pending
                            ? resultCards.length + 1
                            : resultCards.length - index;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={asset.onSelect}
                              title={asset.label}
                              disabled={asset.pending}
                              className="group flex-shrink-0 text-left"
                            >
                              <div
                                className={`relative h-[76px] w-[76px] overflow-hidden transition-all duration-300 ${
                                  asset.id === featuredAsset.id
                                    ? "ring-1 ring-[#2a2520] dark:ring-[#c4bdb4]"
                                    : "opacity-55 group-hover:opacity-100"
                                } ${asset.pending ? "cursor-default" : ""}`}
                              >
                                {asset.pending || !asset.imageUrl ? (
                                  <div className="flex h-full w-full items-center justify-center bg-[#e8e4de] dark:bg-[#1a1614]">
                                    <span className="studio-pulse h-1.5 w-1.5 rounded-full bg-[#8a837a] dark:bg-[#c4bdb4]" />
                                  </div>
                                ) : (
                                  <Image
                                    src={asset.imageUrl}
                                    alt={asset.label}
                                    width={320}
                                    height={320}
                                    unoptimized
                                    className="h-full w-full object-cover"
                                  />
                                )}
                              </div>
                              <span
                                className={`mt-1 block text-center text-[9px] tabular-nums tracking-[0.2em] ${
                                  asset.id === featuredAsset.id
                                    ? "text-[#2a2520] dark:text-[#c4bdb4]"
                                    : "text-[#a39b90] dark:text-[#5c564e]"
                                }`}
                              >
                                {String(frameNumber).padStart(2, "0")}A
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="studio-backdrop flex min-h-[480px] items-center justify-center px-6 py-16 lg:min-h-[calc(100vh-180px)]">
                <div className="flex aspect-[4/5] w-64 flex-col items-center justify-center bg-[#faf8f5] px-8 text-center ring-1 ring-[#d5cfc4] dark:bg-[#141210]/50 dark:ring-[#2a2520]">
                  <span className="studio-pulse mb-5 h-1.5 w-1.5 rounded-full bg-[#8a837a] dark:bg-[#5c564e]" />
                  <p
                    className="text-[15px] italic leading-6 text-[#8a837a] dark:text-[#5c564e]"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    {isRestoringSeries || isLoadingHistory
                      ? t("recoveringPrints")
                      : t("blankPaper")}
                  </p>
                  {!isRestoringSeries && !isLoadingHistory ? (
                    <p className="mt-3 text-[11px] leading-5 tracking-wide text-[#a39b90] dark:text-[#4a443c]">
                      {t("blankPaperHint")}
                    </p>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
