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

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

test("i18n message files have matching keys", () => {
  const en = readJson(join(root, "messages/en.json"));
  const zh = readJson(join(root, "messages/zh.json"));

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

test("component translation keys exist in messages", () => {
  const en = readJson(join(root, "messages/en.json"));

  const requiredKeys = [
    "home.hero.volume",
    "home.hero.open",
    "home.hero.openAriaLabel",
    "home.hero.openingGallery",
    "auth.loginPrompt.favorites.title",
    "auth.loginPrompt.generate.title",
    "nav.credits",
    "nav.settings",
    "nav.profile",
    "profile.favoritesTitle",
    "common.creditsCount",
    "common.categories.portrait",
    "common.timeFilters.today",
    "language.promptLanguage",
    "language.promptEn",
    "language.promptZh",
    "language.promptJa",
  ];

  const flat = new Set(flattenKeys(en));

  for (const key of requiredKeys) {
    assert.ok(flat.has(key), `missing message key: ${key}`);
  }
});

test("buildRemixGenerateUrl stays locale-agnostic", () => {
  const source = readFileSync(
    join(root, "src/lib/generation-draft.ts"),
    "utf8",
  );

  assert.doesNotMatch(source, /locale === "zh"/);
  assert.match(source, /return `\/generate\?/);
});
