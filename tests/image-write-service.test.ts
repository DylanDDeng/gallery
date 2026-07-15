import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createImageRecord,
  ImageWriteConflictError,
  ImageWriteNotFoundError,
  updateImageRecord,
  type ImageMutation,
} from "../src/lib/image-write-service.ts";

const ORIGINAL_URL =
  "https://image-1325800846.cos.ap-nanjing.myqcloud.com/original.png";
const CHANGED_URL =
  "https://image-1325800846.cos.ap-nanjing.myqcloud.com/changed.png";

const body = (url = ORIGINAL_URL) => ({
  url,
  prompt: "prompt",
  author: "author",
  model: "model",
  category: "portrait",
  tags: ["tag"],
  width: 1,
  height: 1,
  tweet_url: "",
  prompt_zh: "",
  prompt_ja: "",
});

describe("image write service", () => {
  it("POST resolves dimensions and ignores client-supplied width and height", async () => {
    let inserted: ImageMutation | null = null;
    const created = await createImageRecord(body(), {
      resolveDimensions: async (url) => {
        assert.equal(url, ORIGINAL_URL);
        return { width: 1536, height: 1024 };
      },
      insert: async (mutation) => {
        inserted = mutation;
        return { id: "created" };
      },
    });

    assert.deepEqual(created, { id: "created" });
    assert.equal(inserted?.width, 1536);
    assert.equal(inserted?.height, 1024);
  });

  it("POST performs no insert when metadata resolution fails", async () => {
    let insertCalls = 0;
    const metadataError = new Error("metadata unavailable");

    await assert.rejects(
      createImageRecord(body(), {
        resolveDimensions: async () => {
          throw metadataError;
        },
        insert: async () => {
          insertCalls += 1;
          return { id: "must-not-exist" };
        },
      }),
      metadataError
    );
    assert.equal(insertCalls, 0);
  });

  it("PUT preserves valid stored dimensions when the URL is unchanged", async () => {
    let resolveCalls = 0;
    let updated: ImageMutation | null = null;

    await updateImageRecord("image-1", body(), {
      findById: async () => ({
        id: "image-1",
        url: ORIGINAL_URL,
        width: 1200,
        height: 1800,
      }),
      resolveDimensions: async () => {
        resolveCalls += 1;
        return { width: 1, height: 1 };
      },
      updateIfCurrentUrl: async (id, originalUrl, mutation) => {
        assert.equal(id, "image-1");
        assert.equal(originalUrl, ORIGINAL_URL);
        updated = mutation;
        return { id };
      },
    });

    assert.equal(resolveCalls, 0);
    assert.equal(updated?.width, 1200);
    assert.equal(updated?.height, 1800);
  });

  it("PUT resolves again for a changed URL or missing stored dimensions", async () => {
    const resolvedUrls: string[] = [];
    const casUrls: string[] = [];

    const run = async (
      updateBody: ReturnType<typeof body>,
      width: number | null,
      height: number | null
    ) =>
      updateImageRecord("image-1", updateBody, {
        findById: async () => ({
          id: "image-1",
          url: ORIGINAL_URL,
          width,
          height,
        }),
        resolveDimensions: async (url) => {
          resolvedUrls.push(url);
          return { width: 900, height: 600 };
        },
        updateIfCurrentUrl: async (_id, originalUrl, mutation) => {
          casUrls.push(originalUrl);
          assert.equal(mutation.width, 900);
          assert.equal(mutation.height, 600);
          return { id: "image-1" };
        },
      });

    await run(body(CHANGED_URL), 1200, 1800);
    await run(body(ORIGINAL_URL), null, null);

    assert.deepEqual(resolvedUrls, [CHANGED_URL, ORIGINAL_URL]);
    assert.deepEqual(casUrls, [ORIGINAL_URL, ORIGINAL_URL]);
  });

  it("PUT performs no update when metadata resolution fails", async () => {
    let updateCalls = 0;
    const metadataError = new Error("metadata unavailable");

    await assert.rejects(
      updateImageRecord("image-1", body(CHANGED_URL), {
        findById: async () => ({
          id: "image-1",
          url: ORIGINAL_URL,
          width: 1200,
          height: 1800,
        }),
        resolveDimensions: async () => {
          throw metadataError;
        },
        updateIfCurrentUrl: async () => {
          updateCalls += 1;
          return { id: "image-1" };
        },
      }),
      metadataError
    );

    assert.equal(updateCalls, 0);
  });

  it("PUT reports a conflict when the id plus original URL CAS updates no row", async () => {
    await assert.rejects(
      updateImageRecord("image-1", body(), {
        findById: async () => ({
          id: "image-1",
          url: ORIGINAL_URL,
          width: 1200,
          height: 1800,
        }),
        resolveDimensions: async () => ({ width: 1200, height: 1800 }),
        updateIfCurrentUrl: async () => null,
      }),
      ImageWriteConflictError
    );
  });

  it("PUT reports not found before attempting to resolve or update", async () => {
    let sideEffects = 0;

    await assert.rejects(
      updateImageRecord("missing", body(), {
        findById: async () => null,
        resolveDimensions: async () => {
          sideEffects += 1;
          return { width: 1, height: 1 };
        },
        updateIfCurrentUrl: async () => {
          sideEffects += 1;
          return { id: "missing" };
        },
      }),
      ImageWriteNotFoundError
    );

    assert.equal(sideEffects, 0);
  });
});
