export const COS_IMAGE_HOST =
  "image-1325800846.cos.ap-nanjing.myqcloud.com";

const METADATA_QUERY = "imageInfo";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_RESPONSE_BYTES = 16 * 1024;

export interface ImageDimensions {
  width: number;
  height: number;
}

export type CosImageMetadataErrorCode =
  | "INVALID_URL"
  | "UNAVAILABLE"
  | "INVALID_METADATA";

export class CosImageMetadataError extends Error {
  readonly code: CosImageMetadataErrorCode;

  constructor(code: CosImageMetadataErrorCode, message: string) {
    super(message);
    this.name = "CosImageMetadataError";
    this.code = code;
  }
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

interface ResolverOptions {
  fetch?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutMs?: number;
  maxRetries?: number;
  maxResponseBytes?: number;
}

class RetryableMetadataError extends Error {}

function metadataUrlFor(imageUrl: string): URL {
  let parsed: URL;

  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new CosImageMetadataError(
      "INVALID_URL",
      "Image URL must be a valid HTTPS COS URL"
    );
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== COS_IMAGE_HOST ||
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hash !== "" ||
    parsed.search !== "" ||
    parsed.pathname === "/"
  ) {
    throw new CosImageMetadataError(
      "INVALID_URL",
      "Image URL must be an unmodified URL on the approved COS host"
    );
  }

  parsed.search = METADATA_QUERY;
  return parsed;
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  maximum: number
) {
  if (!Number.isSafeInteger(value) || (value ?? 0) <= 0) return fallback;
  return Math.min(value as number, maximum);
}

function boundedRetries(value: number | undefined) {
  if (!Number.isSafeInteger(value) || (value ?? -1) < 0) {
    return DEFAULT_MAX_RETRIES;
  }
  return Math.min(value as number, DEFAULT_MAX_RETRIES);
}

async function readResponseText(
  response: Response,
  maximumBytes: number
): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > maximumBytes) {
      throw new CosImageMetadataError(
        "INVALID_METADATA",
        "COS image metadata response was too large"
      );
    }
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      bytesRead += value.byteLength;
      if (bytesRead > maximumBytes) {
        await reader.cancel();
        throw new CosImageMetadataError(
          "INVALID_METADATA",
          "COS image metadata response was too large"
        );
      }

      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }

  return text + decoder.decode();
}

function parsePositiveSafeInteger(value: unknown, field: string): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) {
    throw new CosImageMetadataError(
      "INVALID_METADATA",
      `COS image metadata contained an invalid ${field}`
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new CosImageMetadataError(
      "INVALID_METADATA",
      `COS image metadata contained an invalid ${field}`
    );
  }

  return parsed;
}

async function fetchMetadataOnce(
  metadataUrl: URL,
  fetchImpl: FetchLike,
  timeoutMs: number,
  maximumBytes: number
): Promise<ImageDimensions> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetchImpl(metadataUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } catch {
      throw new RetryableMetadataError();
    }

    if (response.status === 429 || response.status >= 500) {
      await response.body?.cancel().catch(() => undefined);
      throw new RetryableMetadataError();
    }

    if (response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => undefined);
      throw new CosImageMetadataError(
        "UNAVAILABLE",
        "COS image metadata request returned a redirect"
      );
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new CosImageMetadataError(
        "UNAVAILABLE",
        "COS image metadata request failed"
      );
    }

    const responseText = await readResponseText(response, maximumBytes);
    let metadata: unknown;
    try {
      metadata = JSON.parse(responseText);
    } catch {
      throw new CosImageMetadataError(
        "INVALID_METADATA",
        "COS image metadata response was not valid JSON"
      );
    }

    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
      throw new CosImageMetadataError(
        "INVALID_METADATA",
        "COS image metadata response had an invalid shape"
      );
    }

    const record = metadata as Record<string, unknown>;
    return {
      width: parsePositiveSafeInteger(record.width, "width"),
      height: parsePositiveSafeInteger(record.height, "height"),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Reads dimensions from Tencent COS without downloading the original image.
 * Security-related limits can only be lowered through options, never raised.
 */
export async function resolveCosImageDimensions(
  imageUrl: string,
  options: ResolverOptions = {}
): Promise<ImageDimensions> {
  const metadataUrl = metadataUrlFor(imageUrl);
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const timeoutMs = boundedInteger(
    options.timeoutMs,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS
  );
  const maximumBytes = boundedInteger(
    options.maxResponseBytes,
    DEFAULT_MAX_RESPONSE_BYTES,
    DEFAULT_MAX_RESPONSE_BYTES
  );
  const maximumRetries = boundedRetries(options.maxRetries);

  for (let attempt = 0; attempt <= maximumRetries; attempt += 1) {
    try {
      return await fetchMetadataOnce(
        metadataUrl,
        fetchImpl,
        timeoutMs,
        maximumBytes
      );
    } catch (error) {
      if (error instanceof CosImageMetadataError) throw error;
      // Fetch and response-stream failures are both network failures. This also
      // covers an abort firing after headers arrive but before the body ends.
      if (attempt === maximumRetries) {
        throw new CosImageMetadataError(
          "UNAVAILABLE",
          "COS image metadata request was unavailable"
        );
      }
      await sleep(100 * 2 ** attempt);
    }
  }

  throw new CosImageMetadataError(
    "UNAVAILABLE",
    "COS image metadata request was unavailable"
  );
}
