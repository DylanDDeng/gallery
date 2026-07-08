import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isUserOwnedStorageUrl,
  pickTrustedReferenceUrl,
} from "../src/lib/reference-image-url.ts";

describe("reference-image-url", () => {
  const userId = "user-123";
  const catalogUrl = "https://cdn.example.com/gallery/photo.jpg";
  const ownedUrl = `https://example.supabase.co/storage/v1/object/public/generations/${userId}/reference-images/test.png`;

  it("prefers user-owned storage over a stale source image id", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const result = pickTrustedReferenceUrl(userId, ownedUrl, catalogUrl);
    assert.equal(result.url, ownedUrl);
    assert.equal(result.error, null);
    assert.equal(isUserOwnedStorageUrl(ownedUrl, userId), true);
  });

  it("falls back to catalog url when no owned override is present", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const result = pickTrustedReferenceUrl(userId, catalogUrl, catalogUrl);
    assert.equal(result.url, catalogUrl);
    assert.equal(result.error, null);
  });

  it("rejects arbitrary external urls", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const result = pickTrustedReferenceUrl(
      userId,
      "https://evil.example/internal.png",
      null
    );
    assert.equal(result.url, null);
    assert.match(result.error ?? "", /uploaded or generated/i);
  });

  it("rejects mismatched catalog and external override urls", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const result = pickTrustedReferenceUrl(
      userId,
      "https://evil.example/internal.png",
      catalogUrl
    );
    assert.equal(result.url, null);
    assert.match(result.error ?? "", /uploaded or generated/i);
  });
});
