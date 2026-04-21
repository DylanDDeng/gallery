import type { OutputResolution } from "@/lib/generation-size-options";

export const MODEL_PRICING = {
  "doubao-seedream-5-0-260128": {
    id: "doubao-seedream-5-0-260128",
    name: "Seedream-5.0-Lite",
    description: "Balanced quality with support for 2K and 3K renders.",
    resolutionCredits: {
      "2K": 12,
      "3K": 16,
    },
  },
} as const;

export type SupportedModelId = keyof typeof MODEL_PRICING;

export const DEFAULT_MODEL_ID: SupportedModelId = "doubao-seedream-5-0-260128";
export const STANDARD_MODEL_ID = DEFAULT_MODEL_ID;
export const STANDARD_RESOLUTION: OutputResolution = "2K";

export const MODEL_OPTIONS = Object.values(MODEL_PRICING);

export function isSupportedModelId(value: string): value is SupportedModelId {
  return value in MODEL_PRICING;
}

export function getModelPricing(modelId: string) {
  return MODEL_PRICING[
    isSupportedModelId(modelId) ? modelId : DEFAULT_MODEL_ID
  ];
}

export function getGenerationCreditsCost(
  modelId: string,
  resolution: OutputResolution
) {
  return getModelPricing(modelId).resolutionCredits[resolution];
}

export function getResolutionCreditsLabel(
  modelId: string,
  resolution: OutputResolution
) {
  const credits = getGenerationCreditsCost(modelId, resolution);
  return `${resolution} · ${credits} credits`;
}

export function getApproximateRenderCount(
  credits: number,
  modelId = STANDARD_MODEL_ID,
  resolution: OutputResolution = STANDARD_RESOLUTION
) {
  return Math.floor(credits / getGenerationCreditsCost(modelId, resolution));
}
