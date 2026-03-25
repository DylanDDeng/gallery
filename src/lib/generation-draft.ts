import type { ImagePrompt } from "@/lib/types";

export type GenerationMode = "new" | "remix";
export type GenerationReturnTarget = "gallery" | "original";

export interface GenerationSourceContext {
  mode: GenerationMode;
  prompt?: string;
  sourceImageId?: string;
  sourceImage?: Partial<ImagePrompt>;
  referenceImages?: Partial<ImagePrompt>[];
  returnTo?: GenerationReturnTarget;
  returnImageId?: string;
}

export interface RemixGenerationDraft extends GenerationSourceContext {
  prompt: string;
  promptLang: "en" | "zh" | "ja";
  createdAt: number;
}

export interface RemixSeriesItem {
  id: string;
  result_url: string;
  prompt: string;
  model: string;
  created_at: string;
  source_image_id?: string | null;
}

export interface CanvasCardPosition {
  x: number;
  y: number;
}

export interface RemixContextSnapshot {
  sourceImage: Partial<ImagePrompt>;
  referenceImages?: Partial<ImagePrompt>[];
  tasks: RemixSeriesItem[];
  taskCardSlotIds?: Record<string, string>;
  cardPositions?: Record<string, CanvasCardPosition>;
  savedAt: number;
}

const DRAFT_STORAGE_KEY = "aestara:generation-draft";
const REMIX_CONTEXT_KEY_PREFIX = "aestara:remix-context";

function hasWindow() {
  return typeof window !== "undefined";
}

function readStorageValue(): string | null {
  if (!hasWindow()) return null;

  try {
    return window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorageValue(value: string) {
  if (!hasWindow()) return;

  try {
    window.sessionStorage.setItem(DRAFT_STORAGE_KEY, value);
  } catch {
    // Ignore storage failures and keep the page usable.
  }
}

function readNamespacedStorageValue(key: string): string | null {
  if (!hasWindow()) return null;

  try {
    return (
      window.localStorage.getItem(key) ??
      window.sessionStorage.getItem(key)
    );
  } catch {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function writeNamespacedStorageValue(key: string, value: string) {
  if (!hasWindow()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignore storage failures and keep the page usable.
    }
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore cleanup failures and keep the page usable.
  }
}

function removeNamespacedStorageValue(key: string) {
  if (!hasWindow()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep the page usable.
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures and keep the page usable.
  }
}

export function readGenerationDraft(): GenerationSourceContext | null {
  const raw = readStorageValue();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GenerationSourceContext;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readRemixGenerationDraft(): RemixGenerationDraft | null {
  const draft = readGenerationDraft();
  if (!draft || draft.mode !== "remix") {
    return null;
  }

  return {
    mode: "remix",
    prompt: draft.prompt ?? "",
    promptLang: "en",
    createdAt: Date.now(),
    sourceImageId: draft.sourceImageId,
    sourceImage: draft.sourceImage,
    referenceImages: draft.referenceImages,
    returnTo: draft.returnTo,
    returnImageId: draft.returnImageId,
  };
}

export function saveGenerationDraft(draft: GenerationSourceContext) {
  writeStorageValue(JSON.stringify(draft));
}

export function saveRemixGenerationDraft(draft: RemixGenerationDraft) {
  writeStorageValue(JSON.stringify(draft));
}

export function clearGenerationDraft() {
  if (!hasWindow()) return;

  try {
    window.sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Ignore storage failures and keep the page usable.
  }
}

function buildRemixContextStorageKey(userId: string, sourceImageId: string) {
  return `${REMIX_CONTEXT_KEY_PREFIX}:${userId}:${sourceImageId}`;
}

export function readRemixContextSnapshot(
  userId: string,
  sourceImageId: string
): RemixContextSnapshot | null {
  if (!userId || !sourceImageId) {
    return null;
  }

  const raw = readNamespacedStorageValue(
    buildRemixContextStorageKey(userId, sourceImageId)
  );

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as RemixContextSnapshot;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.filter((task): task is RemixSeriesItem => {
          if (!task || typeof task !== "object") return false;
          const candidate = task as Partial<RemixSeriesItem>;
          return (
            typeof candidate.id === "string" &&
            typeof candidate.result_url === "string" &&
            typeof candidate.prompt === "string" &&
            typeof candidate.model === "string" &&
            typeof candidate.created_at === "string"
          );
        })
      : [];

    return {
      sourceImage:
        parsed.sourceImage && typeof parsed.sourceImage === "object"
          ? parsed.sourceImage
          : {},
      referenceImages: Array.isArray(parsed.referenceImages)
        ? parsed.referenceImages.filter(
            (image): image is Partial<ImagePrompt> =>
              Boolean(image && typeof image === "object")
          )
        : [],
      taskCardSlotIds:
        parsed.taskCardSlotIds && typeof parsed.taskCardSlotIds === "object"
          ? Object.fromEntries(
              Object.entries(parsed.taskCardSlotIds).filter(
                ([taskId, slotId]) =>
                  Boolean(taskId) &&
                  typeof slotId === "string" &&
                  slotId.trim().length > 0
              )
            )
          : {},
      cardPositions:
        parsed.cardPositions && typeof parsed.cardPositions === "object"
          ? Object.fromEntries(
              Object.entries(parsed.cardPositions).filter(
                ([cardId, position]) =>
                  Boolean(cardId) &&
                  Boolean(position) &&
                  typeof position === "object" &&
                  typeof (position as CanvasCardPosition).x === "number" &&
                  typeof (position as CanvasCardPosition).y === "number"
              )
            )
          : {},
      tasks,
      savedAt:
        typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveRemixContextSnapshot(
  userId: string,
  sourceImageId: string,
  snapshot: RemixContextSnapshot
) {
  if (!userId || !sourceImageId) {
    return;
  }

  writeNamespacedStorageValue(
    buildRemixContextStorageKey(userId, sourceImageId),
    JSON.stringify(snapshot)
  );
}

export function clearRemixContextSnapshot(
  userId: string,
  sourceImageId: string
) {
  if (!userId || !sourceImageId) {
    return;
  }

  removeNamespacedStorageValue(
    buildRemixContextStorageKey(userId, sourceImageId)
  );
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();
}

export function parseGenerationDraftFromSearchParams(
  searchParams: URLSearchParams
): GenerationSourceContext | null {
  const mode = searchParams.get("mode");
  const sourceImageId = firstNonEmpty(searchParams.get("sourceImageId"));
  const sourcePrompt = firstNonEmpty(searchParams.get("prompt"));
  const sourceAuthor = firstNonEmpty(searchParams.get("sourceAuthor"));
  const sourceModel = firstNonEmpty(searchParams.get("sourceModel"));
  const sourceImageUrl = firstNonEmpty(searchParams.get("sourceImageUrl"));
  const sourceCategory = firstNonEmpty(searchParams.get("sourceCategory"));
  const returnTo = firstNonEmpty(searchParams.get("returnTo")) as GenerationReturnTarget | undefined;
  const returnImageId = firstNonEmpty(searchParams.get("returnImageId"));

  if (!mode && !sourceImageId && !sourcePrompt && !sourceAuthor && !sourceModel && !sourceImageUrl) {
    return null;
  }

  return {
    mode: mode === "remix" ? "remix" : "new",
    prompt: sourcePrompt || undefined,
    sourceImageId: sourceImageId || undefined,
    sourceImage:
      sourceImageId || sourceImageUrl || sourcePrompt || sourceAuthor || sourceModel || sourceCategory
        ? {
            id: sourceImageId || undefined,
            url: sourceImageUrl || undefined,
            prompt: sourcePrompt || undefined,
            author: sourceAuthor || undefined,
            model: sourceModel || undefined,
            category: sourceCategory || undefined,
          }
        : undefined,
    returnTo: returnTo === "gallery" || returnTo === "original" ? returnTo : undefined,
    returnImageId: returnImageId || undefined,
  };
}

export function buildRemixGenerateUrl(context: {
  sourceImageId?: string;
  sourceImageUrl?: string;
  sourcePrompt?: string;
  sourceAuthor?: string;
  sourceModel?: string;
  sourceCategory?: string;
  returnTo?: GenerationReturnTarget;
  returnImageId?: string;
}) {
  const params = new URLSearchParams({
    mode: "remix",
  });

  if (context.sourceImageId) {
    params.set("sourceImageId", context.sourceImageId);
  }

  if (context.sourceImageUrl) {
    params.set("sourceImageUrl", context.sourceImageUrl);
  }

  if (context.sourcePrompt) {
    params.set("prompt", context.sourcePrompt);
  }

  if (context.sourceAuthor) {
    params.set("sourceAuthor", context.sourceAuthor);
  }

  if (context.sourceModel) {
    params.set("sourceModel", context.sourceModel);
  }

  if (context.sourceCategory) {
    params.set("sourceCategory", context.sourceCategory);
  }

  if (context.returnTo) {
    params.set("returnTo", context.returnTo);
  }

  if (context.returnImageId) {
    params.set("returnImageId", context.returnImageId);
  }

  return `/generate?${params.toString()}`;
}
