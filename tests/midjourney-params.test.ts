import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatMidjourneyVersion,
  midjourneyColumnsFor,
  parseMidjourneyPrompt,
} from "../src/lib/midjourney-params.ts";

describe("parseMidjourneyPrompt", () => {
  it("splits prompt text from parameters", () => {
    const parsed = parseMidjourneyPrompt(
      "film portrait, soft light --v 7 --p 7k2x9ab --sref 2753845127 --ar 2:3 --s 250 --style raw"
    );

    assert.equal(parsed.text, "film portrait, soft light");
    assert.equal(parsed.paramsText, "--v 7 --p 7k2x9ab --sref 2753845127 --ar 2:3 --s 250 --style raw");
    assert.equal(parsed.params.version, "7");
    assert.deepEqual(parsed.params.profiles, ["7k2x9ab"]);
    assert.deepEqual(parsed.params.srefs, ["2753845127"]);
    assert.equal(parsed.params.aspect, "2:3");
    assert.equal(parsed.params.stylize, "250");
    assert.equal(parsed.params.style, "raw");
  });

  it("returns empty params when the prompt has none", () => {
    const parsed = parseMidjourneyPrompt("  a quiet street at dusk ");
    assert.equal(parsed.text, "a quiet street at dusk");
    assert.equal(parsed.paramsText, "");
    assert.deepEqual(parsed.params.profiles, []);
    assert.deepEqual(parsed.params.srefs, []);
    assert.equal(parsed.params.version, null);
  });

  it("accepts profile aliases and multiple codes without duplicates", () => {
    const { params } = parseMidjourneyPrompt(
      "x --profile abc def --personalize ghi --p abc"
    );
    assert.deepEqual(params.profiles, ["abc", "def", "ghi"]);
  });

  it("marks a bare --p as the author's default profile", () => {
    const { params } = parseMidjourneyPrompt("x --p --ar 1:1");
    assert.deepEqual(params.profiles, []);
    assert.equal(params.usesDefaultProfile, true);
    assert.equal(params.aspect, "1:1");
  });

  it("drops sref weights, image URLs and random", () => {
    const { params } = parseMidjourneyPrompt(
      "x --sref 123::2 https://example.com/a.png 456 random --sw 200"
    );
    assert.deepEqual(params.srefs, ["123", "456"]);
    assert.equal(params.other.sw, "200");
  });

  it("reads niji versions and em-dash flags from autocorrect", () => {
    const { text, params } = parseMidjourneyPrompt("anime girl —niji 6 —p abc");
    assert.equal(text, "anime girl");
    assert.equal(params.version, "niji 6");
    assert.deepEqual(params.profiles, ["abc"]);
  });

  it("does not treat hyphenated words as parameters", () => {
    const { text, params } = parseMidjourneyPrompt("well-lit room, black-and-white --v 6.1");
    assert.equal(text, "well-lit room, black-and-white");
    assert.equal(params.version, "6.1");
  });
});

describe("midjourneyColumnsFor", () => {
  it("returns null columns for other models", () => {
    assert.deepEqual(midjourneyColumnsFor("GPT Image 2", "x --p abc"), {
      mj_version: null,
      mj_profiles: null,
      mj_srefs: null,
      mj_params: null,
    });
  });

  it("maps parsed params to columns for Midjourney", () => {
    assert.deepEqual(
      midjourneyColumnsFor("Midjourney", "x --v 7 --p abc --sref 1 --ar 3:2 --chaos 10"),
      {
        mj_version: "7",
        mj_profiles: ["abc"],
        mj_srefs: ["1"],
        mj_params: { chaos: "10", ar: "3:2" },
      }
    );
  });
});

describe("formatMidjourneyVersion", () => {
  it("labels numbered and niji versions", () => {
    assert.equal(formatMidjourneyVersion("7"), "V7");
    assert.equal(formatMidjourneyVersion("6.1"), "V6.1");
    assert.equal(formatMidjourneyVersion("niji 6"), "Niji 6");
    assert.equal(formatMidjourneyVersion(null), "");
  });
});
