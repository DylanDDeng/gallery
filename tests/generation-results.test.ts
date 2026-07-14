import assert from "node:assert/strict";
import test from "node:test";

import { selectFeaturedResult } from "../src/lib/generation-results.ts";

const results = [
  { id: "latest", imageUrl: "/latest.png" },
  { id: "previous", imageUrl: "/previous.png" },
];

test("keeps the explicitly featured generated result", () => {
  assert.equal(selectFeaturedResult(results, "previous"), results[1]);
});

test("falls back to the latest generated result when no result is featured", () => {
  assert.equal(selectFeaturedResult(results, null), results[0]);
});

test("falls back safely when a previously featured result is no longer available", () => {
  assert.equal(selectFeaturedResult(results, "missing"), results[0]);
  assert.equal(selectFeaturedResult([], "missing"), null);
});
