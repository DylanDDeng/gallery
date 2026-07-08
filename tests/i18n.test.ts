import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

test("i18n message files have matching keys", () => {
  const en = JSON.parse(
    readFileSync(join(root, "messages/en.json"), "utf8"),
  ) as Record<string, unknown>;
  const zh = JSON.parse(
    readFileSync(join(root, "messages/zh.json"), "utf8"),
  ) as Record<string, unknown>;

  const enKeys = flattenKeys(en).sort();
  const zhKeys = flattenKeys(zh).sort();

  assert.deepEqual(zhKeys, enKeys);
});

test("i18n routing config supports en and zh", () => {
  const routingSource = readFileSync(
    join(root, "src/i18n/routing.ts"),
    "utf8",
  );

  assert.match(routingSource, /locales:\s*\["en",\s*"zh"\]/);
  assert.match(routingSource, /defaultLocale:\s*"en"/);
  assert.match(routingSource, /localePrefix:\s*"as-needed"/);
});

test("sitemap includes bilingual alternates", () => {
  const sitemapSource = readFileSync(
    join(root, "src/app/sitemap.ts"),
    "utf8",
  );

  assert.match(sitemapSource, /alternates/);
  assert.match(sitemapSource, /\$\{locale\}/);
});
