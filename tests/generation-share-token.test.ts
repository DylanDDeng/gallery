import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createGenerationShareToken,
  readGenerationShareToken,
} from "../src/lib/generation-share-token.ts";
import { buildXShareUrl } from "../src/lib/generation-share-url.ts";

const taskId = "26b7e793-7acc-4ad0-8906-07691f60a562";
const secret = "a-local-test-secret-that-is-long-enough";

test("generation share token round-trips the task id", () => {
  const token = createGenerationShareToken(taskId, secret);

  assert.equal(readGenerationShareToken(token, secret), taskId);
});

test("generation share token rejects tampering and the wrong secret", () => {
  const token = createGenerationShareToken(taskId, secret);
  const [payload, signature] = token.split(".");
  const tampered = `${payload}.${signature.slice(0, -1)}x`;

  assert.equal(readGenerationShareToken(tampered, secret), null);
  assert.equal(readGenerationShareToken(token, "another-secret"), null);
});

test("generation share token rejects malformed ids and tokens", () => {
  assert.throws(() => createGenerationShareToken("not-a-task-id", secret));
  assert.equal(readGenerationShareToken("not-a-token", secret), null);
});

test("X share intent contains the public URL and localized text", () => {
  const shareUrl = "https://www.aestara.art/zh/share/signed-token";
  const text = "我的新作品，由 Aestara 创作。";
  const intent = new URL(buildXShareUrl(shareUrl, text));

  assert.equal(intent.origin, "https://twitter.com");
  assert.equal(intent.pathname, "/intent/tweet");
  assert.equal(intent.searchParams.get("text"), text);
  assert.equal(intent.searchParams.get("url"), shareUrl);
});
