import { readResponseBodyWithLimit } from "./fetch-with-limit";

const ZENMUX_GENERATIONS_ENDPOINT =
  "https://zenmux.ai/api/v1/images/generations";
const ZENMUX_EDITS_ENDPOINT = "https://zenmux.ai/api/v1/images/edits";
const GPT_IMAGE_MODEL = "openai/gpt-image-2";

export type ZenMuxQuality = "medium" | "high";

export interface ZenMuxGenerateParams {
  apiKey: string;
  prompt: string;
  model?: string;
  size: string;
  quality: ZenMuxQuality;
  outputFormat?: "png" | "jpeg" | "webp";
}

export interface ZenMuxEditParams extends ZenMuxGenerateParams {
  imageUrls: string[];
}

export interface ZenMuxImageResult {
  buffer: ArrayBuffer;
  revisedPrompt?: string;
}

interface ZenMuxImageData {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

interface ZenMuxResponse {
  data?: ZenMuxImageData[];
  error?: {
    message?: string;
  };
}

const EDITABLE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const MAX_REFERENCE_IMAGE_BYTES = 15 * 1024 * 1024;

export function mapZenMuxErrorMessage(message: string) {
  if (/moderation|safety|policy|blocked/i.test(message)) {
    return "Your prompt was rejected by content moderation. Please revise and try again.";
  }

  return message;
}

function parseZenMuxError(response: Response, errorText: string) {
  let errorMessage = `ZenMux API error: ${response.status}`;

  try {
    const errorJson = JSON.parse(errorText) as ZenMuxResponse;
    if (errorJson.error?.message) {
      errorMessage = errorJson.error.message;
    }
  } catch {
    if (errorText.trim()) {
      errorMessage = errorText.trim();
    }
  }

  return mapZenMuxErrorMessage(errorMessage);
}

function decodeImageData(data: ZenMuxImageData): ZenMuxImageResult {
  if (data.b64_json) {
    const binary = Buffer.from(data.b64_json, "base64");
    return {
      buffer: binary.buffer.slice(
        binary.byteOffset,
        binary.byteOffset + binary.byteLength
      ),
      revisedPrompt: data.revised_prompt,
    };
  }

  if (data.url) {
    throw new Error("ZenMux returned a URL; caller must download it separately");
  }

  throw new Error("No image data in ZenMux response");
}

async function downloadImageFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ZenMux image: ${response.status}`);
  }

  return response.arrayBuffer();
}

async function resolveImageResult(data: ZenMuxImageData): Promise<ZenMuxImageResult> {
  if (data.b64_json) {
    return decodeImageData(data);
  }

  if (data.url) {
    return {
      buffer: await downloadImageFromUrl(data.url),
      revisedPrompt: data.revised_prompt,
    };
  }

  throw new Error("No image data in ZenMux response");
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

async function fetchReferenceImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch reference image: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_REFERENCE_IMAGE_BYTES) {
    throw new Error("Reference image is too large");
  }

  const buffer = await readResponseBodyWithLimit(
    response,
    MAX_REFERENCE_IMAGE_BYTES
  );

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  if (!contentType || !EDITABLE_MIME_TYPES.has(contentType)) {
    throw new Error(
      "Reference image must be PNG, JPEG, or WEBP for GPT Image 2 edits"
    );
  }

  const extension = extensionForMimeType(contentType);

  return {
    buffer,
    contentType,
    filename: `reference.${extension}`,
  };
}

export class ZenMuxClient {
  async generate(params: ZenMuxGenerateParams): Promise<ZenMuxImageResult> {
    const response = await fetch(ZENMUX_GENERATIONS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || GPT_IMAGE_MODEL,
        prompt: params.prompt,
        size: params.size,
        quality: params.quality,
        n: 1,
        output_format: params.outputFormat || "png",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseZenMuxError(response, errorText));
    }

    const json = (await response.json()) as ZenMuxResponse;
    const imageData = json.data?.[0];
    if (!imageData) {
      throw new Error("No image data in ZenMux response");
    }

    return resolveImageResult(imageData);
  }

  async edit(params: ZenMuxEditParams): Promise<ZenMuxImageResult> {
    if (params.imageUrls.length === 0) {
      throw new Error("At least one reference image is required for edits");
    }

    const formData = new FormData();
    formData.append("model", params.model || GPT_IMAGE_MODEL);
    formData.append("prompt", params.prompt);
    formData.append("size", params.size);
    formData.append("quality", params.quality);
    formData.append("n", "1");
    formData.append("output_format", params.outputFormat || "png");

    for (const imageUrl of params.imageUrls) {
      const reference = await fetchReferenceImage(imageUrl);
      const blob = new Blob([reference.buffer], { type: reference.contentType });
      formData.append("image[]", blob, reference.filename);
    }

    const response = await fetch(ZENMUX_EDITS_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(parseZenMuxError(response, errorText));
    }

    const json = (await response.json()) as ZenMuxResponse;
    const imageData = json.data?.[0];
    if (!imageData) {
      throw new Error("No image data in ZenMux response");
    }

    return resolveImageResult(imageData);
  }
}

export const zenMuxClient = new ZenMuxClient();
