import type { ImageDimensions } from "./cos-image-metadata-core";

export interface ImageWriteBody {
  url?: unknown;
  prompt?: unknown;
  author?: unknown;
  model?: unknown;
  category?: unknown;
  tags?: unknown;
  width?: unknown;
  height?: unknown;
  tweet_url?: unknown;
  prompt_zh?: unknown;
  prompt_ja?: unknown;
}

export interface ExistingImageDimensions {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
}

export interface ImageMutation {
  url: string;
  prompt: unknown;
  author: unknown;
  model: unknown;
  category: unknown;
  tags: unknown;
  width: number;
  height: number;
  tweet_url: unknown;
  prompt_zh: unknown;
  prompt_ja: unknown;
}

type ResolveDimensions = (url: string) => Promise<ImageDimensions>;

export class ImageWriteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageWriteValidationError";
  }
}

export class ImageWriteNotFoundError extends Error {
  constructor() {
    super("Image not found");
    this.name = "ImageWriteNotFoundError";
  }
}

export class ImageWriteConflictError extends Error {
  constructor() {
    super("Image changed while it was being updated");
    this.name = "ImageWriteConflictError";
  }
}

function imageUrlFrom(value: unknown, fallback?: string): string {
  if (value === undefined && fallback) return fallback;
  if (typeof value !== "string" || value.trim() === "") {
    throw new ImageWriteValidationError("Image URL is required");
  }
  return value.trim();
}

function nullableValue(value: unknown): unknown {
  return value || null;
}

function mutationFrom(
  body: ImageWriteBody,
  url: string,
  dimensions: ImageDimensions
): ImageMutation {
  return {
    url,
    prompt: body.prompt,
    author: body.author,
    model: body.model,
    category: body.category,
    tags: body.tags,
    width: dimensions.width,
    height: dimensions.height,
    tweet_url: nullableValue(body.tweet_url),
    prompt_zh: nullableValue(body.prompt_zh),
    prompt_ja: nullableValue(body.prompt_ja),
  };
}

export function hasValidStoredDimensions(
  image: Pick<ExistingImageDimensions, "width" | "height">
): image is { width: number; height: number } {
  return (
    Number.isSafeInteger(image.width) &&
    (image.width ?? 0) > 0 &&
    Number.isSafeInteger(image.height) &&
    (image.height ?? 0) > 0
  );
}

export async function createImageRecord<T>(
  body: ImageWriteBody,
  dependencies: {
    resolveDimensions: ResolveDimensions;
    insert: (mutation: ImageMutation) => Promise<T>;
  }
): Promise<T> {
  const url = imageUrlFrom(body.url);
  const dimensions = await dependencies.resolveDimensions(url);
  return dependencies.insert(mutationFrom(body, url, dimensions));
}

export async function updateImageRecord<T>(
  id: string,
  body: ImageWriteBody,
  dependencies: {
    resolveDimensions: ResolveDimensions;
    findById: (id: string) => Promise<ExistingImageDimensions | null>;
    updateIfCurrentUrl: (
      id: string,
      originalUrl: string,
      mutation: ImageMutation
    ) => Promise<T | null>;
  }
): Promise<T> {
  const existing = await dependencies.findById(id);
  if (!existing) throw new ImageWriteNotFoundError();

  const url = imageUrlFrom(body.url, existing.url);
  const dimensions =
    url === existing.url && hasValidStoredDimensions(existing)
      ? { width: existing.width, height: existing.height }
      : await dependencies.resolveDimensions(url);

  const updated = await dependencies.updateIfCurrentUrl(
    id,
    existing.url,
    mutationFrom(body, url, dimensions)
  );
  if (!updated) throw new ImageWriteConflictError();

  return updated;
}
