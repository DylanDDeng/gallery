import assert from "node:assert/strict";
import { describe, it } from "node:test";

function getGenerationsStoragePublicPrefix() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!supabaseUrl) {
    return null;
  }

  return `${supabaseUrl}/storage/v1/object/public/generations/`;
}

function isUserOwnedStorageUrl(url: string, userId: string) {
  const prefix = getGenerationsStoragePublicPrefix();
  if (!prefix) {
    return false;
  }

  if (!url.startsWith(prefix)) {
    return false;
  }

  const objectPath = url.slice(prefix.length);
  return objectPath.startsWith(`${userId}/`);
}

describe("reference-image-security", () => {
  it("builds the generations storage public prefix", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.equal(
      getGenerationsStoragePublicPrefix(),
      "https://example.supabase.co/storage/v1/object/public/generations/"
    );
  });

  it("accepts user-owned storage URLs", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const userId = "user-123";
    const url = `https://example.supabase.co/storage/v1/object/public/generations/${userId}/reference-images/test.png`;

    assert.equal(isUserOwnedStorageUrl(url, userId), true);
    assert.equal(isUserOwnedStorageUrl(url, "other-user"), false);
  });

  it("rejects arbitrary external URLs", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.equal(
      isUserOwnedStorageUrl("https://evil.example/internal.png", "user-123"),
      false
    );
  });
});
