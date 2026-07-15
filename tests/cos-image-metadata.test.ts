import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  COS_IMAGE_HOST,
  CosImageMetadataError,
  resolveCosImageDimensions,
} from "../src/lib/cos-image-metadata-core.ts";

const VALID_IMAGE_URL = `https://${COS_IMAGE_HOST}/folder/image.png`;

const metadataResponse = (width = "1200", height = "800") =>
  new Response(JSON.stringify({ width, height }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("resolveCosImageDimensions", () => {
  it("requests only the COS imageInfo endpoint with redirect protection", async () => {
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;

    const dimensions = await resolveCosImageDimensions(VALID_IMAGE_URL, {
      fetch: async (input, init) => {
        requestedUrl = String(input);
        requestedInit = init;
        return metadataResponse();
      },
      sleep: async () => undefined,
    });

    assert.deepEqual(dimensions, { width: 1200, height: 800 });
    assert.equal(requestedUrl, `${VALID_IMAGE_URL}?imageInfo`);
    assert.equal(requestedInit?.redirect, "manual");
    assert.equal(requestedInit?.method, "GET");
    assert.ok(requestedInit?.signal instanceof AbortSignal);
  });

  it("rejects unapproved and ambiguous URLs before any request", async () => {
    const invalidUrls = [
      `http://${COS_IMAGE_HOST}/image.png`,
      `https://${COS_IMAGE_HOST}.evil.example/image.png`,
      `https://evil-${COS_IMAGE_HOST}/image.png`,
      `https://${COS_IMAGE_HOST}:8443/image.png`,
      `https://user:password@${COS_IMAGE_HOST}/image.png`,
      `https://${COS_IMAGE_HOST}/image.png#fragment`,
      `https://${COS_IMAGE_HOST}/image.png?imageInfo`,
      `https://${COS_IMAGE_HOST}/image.png?imageMogr2/thumbnail/600x`,
      `https://${COS_IMAGE_HOST}/`,
    ];
    let requests = 0;

    for (const imageUrl of invalidUrls) {
      await assert.rejects(
        resolveCosImageDimensions(imageUrl, {
          fetch: async () => {
            requests += 1;
            return metadataResponse();
          },
        }),
        (error: unknown) =>
          error instanceof CosImageMetadataError &&
          error.code === "INVALID_URL"
      );
    }

    assert.equal(requests, 0);
  });

  it("does not follow or retry redirects", async () => {
    let requests = 0;

    await assert.rejects(
      resolveCosImageDimensions(VALID_IMAGE_URL, {
        fetch: async () => {
          requests += 1;
          return new Response(null, {
            status: 302,
            headers: { location: "https://internal.example/metadata" },
          });
        },
        sleep: async () => undefined,
      }),
      (error: unknown) =>
        error instanceof CosImageMetadataError && error.code === "UNAVAILABLE"
    );

    assert.equal(requests, 1);
  });

  it("retries network, 429, and 5xx failures at most twice", async () => {
    let requests = 0;

    const dimensions = await resolveCosImageDimensions(VALID_IMAGE_URL, {
      fetch: async () => {
        requests += 1;
        if (requests === 1) throw new TypeError("network failure");
        if (requests === 2) return new Response(null, { status: 503 });
        return metadataResponse("640", "960");
      },
      sleep: async () => undefined,
    });

    assert.deepEqual(dimensions, { width: 640, height: 960 });
    assert.equal(requests, 3);

    requests = 0;
    await assert.rejects(
      resolveCosImageDimensions(VALID_IMAGE_URL, {
        fetch: async () => {
          requests += 1;
          return new Response(null, { status: 429 });
        },
        sleep: async () => undefined,
      }),
      (error: unknown) =>
        error instanceof CosImageMetadataError && error.code === "UNAVAILABLE"
    );
    assert.equal(requests, 3);
  });

  it("times out each attempt and keeps the retry bound", async () => {
    let requests = 0;

    await assert.rejects(
      resolveCosImageDimensions(VALID_IMAGE_URL, {
        timeoutMs: 2,
        sleep: async () => undefined,
        fetch: async (_input, init) => {
          requests += 1;
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true }
            );
          });
        },
      }),
      (error: unknown) =>
        error instanceof CosImageMetadataError && error.code === "UNAVAILABLE"
    );

    assert.equal(requests, 3);
  });

  it("rejects invalid JSON and non-positive or unsafe dimensions", async () => {
    const invalidResponses = [
      new Response("not-json", { status: 200 }),
      new Response(JSON.stringify({ width: 100, height: "200" }), {
        status: 200,
      }),
      metadataResponse("0", "200"),
      metadataResponse("120", "-1"),
      metadataResponse("01", "200"),
      metadataResponse(String(Number.MAX_SAFE_INTEGER + 1), "200"),
      new Response(JSON.stringify({ width: "120" }), { status: 200 }),
    ];

    for (const response of invalidResponses) {
      await assert.rejects(
        resolveCosImageDimensions(VALID_IMAGE_URL, {
          fetch: async () => response,
          maxRetries: 0,
        }),
        (error: unknown) =>
          error instanceof CosImageMetadataError &&
          error.code === "INVALID_METADATA"
      );
    }
  });

  it("caps metadata response bytes before parsing", async () => {
    await assert.rejects(
      resolveCosImageDimensions(VALID_IMAGE_URL, {
        fetch: async () =>
          new Response(JSON.stringify({ width: "120", height: "200" }), {
            status: 200,
          }),
        maxResponseBytes: 8,
        maxRetries: 0,
      }),
      (error: unknown) =>
        error instanceof CosImageMetadataError &&
        error.code === "INVALID_METADATA"
    );
  });
});
