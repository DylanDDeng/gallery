import type { AspectRatio, OutputResolution } from "@/lib/generation-size-options";

export type ModelProvider = "doubao" | "zenmux";

export interface ModelTier {
  id: string;
  label: string;
  credits: number;
  providerParams: Record<string, string>;
}

export interface ModelPricingEntry {
  id: string;
  name: string;
  description: string;
  provider: ModelProvider;
  tiers: ModelTier[];
  usesAspectRatio: boolean;
}

const SEEDREAM_TIERS: ModelTier[] = [
  {
    id: "2K",
    label: "2K",
    credits: 12,
    providerParams: { resolution: "2K" },
  },
  {
    id: "3K",
    label: "3K",
    credits: 16,
    providerParams: { resolution: "3K" },
  },
];

const GPT_IMAGE_TIERS: ModelTier[] = [
  {
    id: "medium-square",
    label: "Medium · Square",
    credits: 12,
    providerParams: { quality: "medium", size: "1024x1024" },
  },
  {
    id: "medium-landscape",
    label: "Medium · Landscape",
    credits: 16,
    providerParams: { quality: "medium", size: "1536x1024" },
  },
  {
    id: "medium-portrait",
    label: "Medium · Portrait",
    credits: 16,
    providerParams: { quality: "medium", size: "1024x1536" },
  },
  {
    id: "high-square",
    label: "High · Square",
    credits: 44,
    providerParams: { quality: "high", size: "1024x1024" },
  },
  {
    id: "high-landscape",
    label: "High · Landscape",
    credits: 66,
    providerParams: { quality: "high", size: "1536x1024" },
  },
  {
    id: "high-portrait",
    label: "High · Portrait",
    credits: 66,
    providerParams: { quality: "high", size: "1024x1536" },
  },
];

export const MODEL_PRICING = {
  "doubao-seedream-5-0-260128": {
    id: "doubao-seedream-5-0-260128",
    name: "Seedream-5.0-Lite",
    description: "Balanced quality with support for 2K and 3K renders.",
    provider: "doubao",
    tiers: SEEDREAM_TIERS,
    usesAspectRatio: true,
  },
  "openai/gpt-image-2": {
    id: "openai/gpt-image-2",
    name: "GPT Image 2",
    description: "OpenAI image generation with medium and high quality tiers.",
    provider: "zenmux",
    tiers: GPT_IMAGE_TIERS,
    usesAspectRatio: false,
  },
} as const satisfies Record<string, ModelPricingEntry>;

export type SupportedModelId = keyof typeof MODEL_PRICING;

export const DEFAULT_MODEL_ID: SupportedModelId = "doubao-seedream-5-0-260128";
export const STANDARD_MODEL_ID = DEFAULT_MODEL_ID;
export const STANDARD_TIER_ID = "2K";
export const STANDARD_RESOLUTION: OutputResolution = "2K";

export const MODEL_OPTIONS = Object.values(MODEL_PRICING);

export function isSupportedModelId(value: string): value is SupportedModelId {
  return value in MODEL_PRICING;
}

export function getModelPricing(modelId: string): ModelPricingEntry {
  return MODEL_PRICING[
    isSupportedModelId(modelId) ? modelId : DEFAULT_MODEL_ID
  ];
}

export function getModelTiers(modelId: string) {
  return getModelPricing(modelId).tiers;
}

export function getDefaultTierId(modelId: string) {
  return getModelTiers(modelId)[0]?.id ?? STANDARD_TIER_ID;
}

export function resolveModelTier(modelId: string, tierId: string) {
  return getModelTiers(modelId).find((tier) => tier.id === tierId) ?? null;
}

export function getGenerationCreditsCost(modelId: string, tierId: string) {
  const tier = resolveModelTier(modelId, tierId);
  if (!tier) {
    return undefined;
  }

  return tier.credits;
}

export function getTierCreditsLabel(modelId: string, tierId: string) {
  const tier = resolveModelTier(modelId, tierId);
  if (!tier) {
    return tierId;
  }

  return `${tier.label} · ${tier.credits} credits`;
}

export function getResolutionCreditsLabel(
  modelId: string,
  resolution: OutputResolution
) {
  return getTierCreditsLabel(modelId, resolution);
}

export function getApproximateRenderCount(
  credits: number,
  modelId = STANDARD_MODEL_ID,
  tierId: string = STANDARD_TIER_ID
) {
  const cost = getGenerationCreditsCost(modelId, tierId);
  if (!cost) {
    return 0;
  }

  return Math.floor(credits / cost);
}

export function isGptImageModel(modelId: string) {
  return getModelPricing(modelId).provider === "zenmux";
}

export function getGptImageOrientationOptions() {
  return [
    { id: "square", label: "1:1", tierSuffix: "square" },
    { id: "landscape", label: "16:9", tierSuffix: "landscape" },
    { id: "portrait", label: "9:16", tierSuffix: "portrait" },
  ] as const;
}

export function getGptImageQualityOptions() {
  return [
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
  ] as const;
}

export function buildGptImageTierId(
  quality: "medium" | "high",
  orientation: "square" | "landscape" | "portrait"
) {
  return `${quality}-${orientation}`;
}

export function parseGptImageTierId(tierId: string) {
  const match = tierId.match(/^(medium|high)-(square|landscape|portrait)$/);
  if (!match) {
    return null;
  }

  return {
    quality: match[1] as "medium" | "high",
    orientation: match[2] as "square" | "landscape" | "portrait",
  };
}

export function modelUsesAspectRatio(modelId: string) {
  return getModelPricing(modelId).usesAspectRatio;
}

export type GptImageOrientation =
  ReturnType<typeof getGptImageOrientationOptions>[number]["id"];
export type GptImageQuality =
  ReturnType<typeof getGptImageQualityOptions>[number]["id"];

export function getSeedreamResolutionFromTier(tierId: string): OutputResolution {
  return tierId === "3K" ? "3K" : "2K";
}

export function getAspectRatioForGptOrientation(
  orientation: GptImageOrientation
): AspectRatio {
  switch (orientation) {
    case "landscape":
      return "16:9";
    case "portrait":
      return "9:16";
    default:
      return "1:1";
  }
}
