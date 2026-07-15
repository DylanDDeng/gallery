import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGptImageTierId,
  getDefaultTierId,
  getGenerationCreditsCost,
  getModelDisplayName,
  isSupportedModelId,
  resolveModelTier,
} from "../src/lib/model-pricing.ts";

describe("model-pricing", () => {
  it("supports gpt-image-2 model id", () => {
    assert.equal(isSupportedModelId("openai/gpt-image-2"), true);
  });

  it("uses gallery-friendly model names for generation ids", () => {
    assert.equal(getModelDisplayName("openai/gpt-image-2"), "GPT Image 2");
    assert.equal(
      getModelDisplayName("doubao-seedream-5-0-260128"),
      "Seedream 5.0 Lite"
    );
    assert.equal(getModelDisplayName("Nano Banana Pro"), "Nano Banana Pro");
  });

  it("prices seedream tiers from server-side tier ids", () => {
    assert.equal(
      getGenerationCreditsCost("doubao-seedream-5-0-260128", "2K"),
      12
    );
    assert.equal(
      getGenerationCreditsCost("doubao-seedream-5-0-260128", "3K"),
      16
    );
  });

  it("prices gpt-image-2 tiers", () => {
    assert.equal(
      getGenerationCreditsCost("openai/gpt-image-2", "medium-square"),
      12
    );
    assert.equal(
      getGenerationCreditsCost("openai/gpt-image-2", "high-landscape"),
      66
    );
  });

  it("rejects unknown tiers instead of silently billing", () => {
    assert.equal(
      getGenerationCreditsCost("openai/gpt-image-2", "3K"),
      undefined
    );
    assert.equal(resolveModelTier("openai/gpt-image-2", "3K"), null);
  });

  it("builds gpt tier ids from quality and orientation", () => {
    assert.equal(buildGptImageTierId("high", "portrait"), "high-portrait");
    const tier = resolveModelTier(
      "openai/gpt-image-2",
      buildGptImageTierId("high", "portrait")
    );
    assert.equal(tier?.credits, 66);
    assert.equal(tier?.providerParams.size, "1024x1536");
    assert.equal(tier?.providerParams.quality, "high");
  });

  it("defaults each model to its first tier", () => {
    assert.equal(getDefaultTierId("doubao-seedream-5-0-260128"), "2K");
    assert.equal(getDefaultTierId("openai/gpt-image-2"), "medium-square");
  });
});

describe("zenmux errors", () => {
  it("maps moderation failures to a friendly message", () => {
    const mapZenMuxErrorMessage = (message: string) => {
      if (/moderation|safety|policy|blocked/i.test(message)) {
        return "Your prompt was rejected by content moderation. Please revise and try again.";
      }

      return message;
    };

    assert.match(
      mapZenMuxErrorMessage("Request blocked by moderation policy"),
      /content moderation/i
    );
  });
});
