import type { ImagePrompt } from "@/lib/types";

export type GenerationMode = "new" | "remix";
export type GenerationReturnTarget = "gallery" | "original";

export interface GenerationSourceContext {
  mode: GenerationMode;
  prompt?: string;
  sourceImageId?: string;
  sourceImage?: Partial<ImagePrompt>;
  returnTo?: GenerationReturnTarget;
  returnImageId?: string;
}

export interface RemixGenerationDraft extends GenerationSourceContext {
  prompt: string;
  promptLang: "en" | "zh" | "ja";
  createdAt: number;
}

const DRAFT_STORAGE_KEY = "aestara:generation-draft";

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
  sourceImageId: string;
  returnTo?: GenerationReturnTarget;
  returnImageId?: string;
}) {
  const params = new URLSearchParams({
    mode: "remix",
    sourceImageId: context.sourceImageId,
  });

  if (context.returnTo) {
    params.set("returnTo", context.returnTo);
  }

  if (context.returnImageId) {
    params.set("returnImageId", context.returnImageId);
  }

  return `/generate?${params.toString()}`;
}
