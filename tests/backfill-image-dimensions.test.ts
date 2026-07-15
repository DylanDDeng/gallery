import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  assertProjectRefConfirmation,
  parseCliArgs,
  rollbackFromManifest,
  runBackfill,
  type BackfillEntry,
  type ImageRow,
  type ImagesGateway,
} from "../scripts/backfill-image-dimensions.mts";

function makeRows(count: number): ImageRow[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    url: `https://image-1325800846.cos.ap-nanjing.myqcloud.com/${index + 1}.png`,
    width: null,
    height: null,
    title: `Image ${index + 1}`,
    prompt: `Prompt ${index + 1}`,
  }));
}

class MemoryGateway implements ImagesGateway {
  rows: ImageRow[];
  setCalls: number[] = [];
  clearCalls: number[] = [];
  conflictIds = new Set<number>();

  constructor(rows: ImageRow[]) {
    this.rows = structuredClone(rows);
  }

  async listAllSnapshot(): Promise<ImageRow[]> {
    return structuredClone(this.rows);
  }

  async setDimensionsIfMissing(entry: BackfillEntry): Promise<boolean> {
    const id = Number(entry.id);
    this.setCalls.push(id);
    if (this.conflictIds.has(id)) {
      return false;
    }
    const row = this.rows.find((candidate) => candidate.id === entry.id);
    if (
      !row ||
      row.url !== entry.imageUrl ||
      row.width !== null ||
      row.height !== null
    ) {
      return false;
    }
    row.width = entry.width;
    row.height = entry.height;
    return true;
  }

  async clearDimensionsIfUnchanged(entry: BackfillEntry): Promise<boolean> {
    const id = Number(entry.id);
    this.clearCalls.push(id);
    const row = this.rows.find((candidate) => candidate.id === entry.id);
    if (
      !row ||
      row.url !== entry.imageUrl ||
      row.width !== entry.width ||
      row.height !== entry.height
    ) {
      return false;
    }
    row.width = null;
    row.height = null;
    return true;
  }
}

const resolver = async (url: string) => {
  const id = Number(new URL(url).pathname.slice(1).split(".")[0]);
  return { width: 600 + id, height: 900 + id };
};

describe("image dimension backfill", () => {
  it("defaults to a dry-run and performs no writes", async () => {
    const gateway = new MemoryGateway(makeRows(12));
    let persistedManifest = false;
    const result = await runBackfill({
      gateway,
      projectRef: "abcdefghijklmnopqrst",
      resolveDimensions: resolver,
      onPrepared: async () => {
        persistedManifest = true;
      },
    });

    assert.equal(result.manifest.mode, "dry-run");
    assert.equal(result.manifest.entries.length, 12);
    assert.equal(result.updatedRows, 0);
    assert.equal(result.verification, null);
    assert.equal(persistedManifest, true);
    assert.deepEqual(gateway.setCalls, []);
    assert.equal(gateway.rows.every((row) => row.width === null), true);
  });

  it("applies ten canaries, verifies them, then applies the remainder", async () => {
    const gateway = new MemoryGateway(makeRows(12));
    const result = await runBackfill({
      gateway,
      projectRef: "abcdefghijklmnopqrst",
      apply: true,
      resolveDimensions: resolver,
      writeConcurrency: 5,
    });

    assert.equal(result.updatedRows, 12);
    assert.deepEqual(gateway.setCalls.slice(0, 10).sort((a, b) => a - b), [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    assert.deepEqual(gateway.setCalls.slice(10).sort((a, b) => a - b), [11, 12]);
    assert.deepEqual(result.verification, {
      totalRows: 12,
      missingDimensions: 0,
      partialDimensions: 0,
      verifiedEntries: 12,
    });
  });

  it("is idempotent: a second successful run updates zero rows", async () => {
    const gateway = new MemoryGateway(makeRows(4));
    await runBackfill({
      gateway,
      projectRef: "abcdefghijklmnopqrst",
      apply: true,
      resolveDimensions: resolver,
    });
    gateway.setCalls = [];
    let resolverCalls = 0;
    const second = await runBackfill({
      gateway,
      projectRef: "abcdefghijklmnopqrst",
      apply: true,
      resolveDimensions: async (url) => {
        resolverCalls += 1;
        return resolver(url);
      },
    });

    assert.equal(second.manifest.entries.length, 0);
    assert.equal(second.updatedRows, 0);
    assert.equal(second.verification?.missingDimensions, 0);
    assert.equal(resolverCalls, 4);
    assert.deepEqual(gateway.setCalls, []);
  });

  it("revalidates dimensions from an earlier partial run before resuming writes", async () => {
    const rows = makeRows(3);
    rows[0].width = 999;
    rows[0].height = 999;
    const gateway = new MemoryGateway(rows);

    await assert.rejects(
      runBackfill({
        gateway,
        projectRef: "abcdefghijklmnopqrst",
        apply: true,
        resolveDimensions: resolver,
      }),
      /Metadata preflight failed for 1\/3 rows; no database writes were attempted/
    );
    assert.deepEqual(gateway.setCalls, []);
  });

  it("treats a zero-row CAS update as a conflict and stops before the remainder", async () => {
    const gateway = new MemoryGateway(makeRows(12));
    gateway.conflictIds.add(4);

    await assert.rejects(
      runBackfill({
        gateway,
        projectRef: "abcdefghijklmnopqrst",
        apply: true,
        resolveDimensions: resolver,
      }),
      /updated 9\/10 rows/
    );
    assert.equal(gateway.setCalls.includes(11), false);
    assert.equal(gateway.setCalls.includes(12), false);
  });

  it("safely resumes a partially written canary run", async () => {
    const gateway = new MemoryGateway(makeRows(12));
    gateway.conflictIds.add(4);
    await assert.rejects(
      runBackfill({
        gateway,
        projectRef: "abcdefghijklmnopqrst",
        apply: true,
        resolveDimensions: resolver,
      }),
      /updated 9\/10 rows/
    );

    gateway.conflictIds.clear();
    gateway.setCalls = [];
    const resumed = await runBackfill({
      gateway,
      projectRef: "abcdefghijklmnopqrst",
      apply: true,
      resolveDimensions: resolver,
    });

    assert.equal(resumed.manifest.missingRowsAtSnapshot, 3);
    assert.equal(resumed.updatedRows, 3);
    assert.deepEqual(gateway.setCalls.sort((a, b) => a - b), [4, 11, 12]);
    assert.equal(resumed.verification?.missingDimensions, 0);
  });

  it("preflights every target and performs no writes if any metadata is invalid", async () => {
    const gateway = new MemoryGateway(makeRows(12));
    let resolverCalls = 0;

    await assert.rejects(
      runBackfill({
        gateway,
        projectRef: "abcdefghijklmnopqrst",
        apply: true,
        resolveDimensions: async (url) => {
          resolverCalls += 1;
          if (url.endsWith("/6.png")) {
            throw new Error("bad metadata");
          }
          return resolver(url);
        },
      }),
      /Metadata preflight failed for 1\/12 rows; no database writes were attempted/
    );
    assert.equal(resolverCalls, 12);
    assert.deepEqual(gateway.setCalls, []);
  });

  it("conditionally rolls back only rows still matching the manifest", async () => {
    const gateway = new MemoryGateway(makeRows(3));
    const applied = await runBackfill({
      gateway,
      projectRef: "abcdefghijklmnopqrst",
      apply: true,
      resolveDimensions: resolver,
    });
    gateway.rows[1].url = `${gateway.rows[1].url}?replaced=1`;
    gateway.rows[2].width = 999;

    const rollback = await rollbackFromManifest({
      gateway,
      manifest: applied.manifest,
    });

    assert.deepEqual(rollback, { revertedRows: 1, conflicts: 2 });
    assert.deepEqual(gateway.clearCalls, [1]);
    assert.equal(gateway.rows[0].width, null);
    assert.notEqual(gateway.rows[1].width, null);
    assert.equal(gateway.rows[2].width, 999);
  });

  it("requires explicit apply for rollback and defaults the normal command to dry-run", () => {
    assert.equal(parseCliArgs([]).apply, false);
    assert.throws(
      () => parseCliArgs(["--rollback", "--manifest", "manifest.json"]),
      /requires explicit --apply/
    );
    const apply = parseCliArgs([
      "--apply",
      "--confirm-project-ref",
      "abcdefghijklmnopqrst",
    ]);
    assert.equal(apply.apply, true);
    assert.equal(apply.confirmProjectRef, "abcdefghijklmnopqrst");
    assert.throws(
      () => assertProjectRefConfirmation(true, null, "abcdefghijklmnopqrst"),
      /Write refused/
    );
    assert.throws(
      () =>
        assertProjectRefConfirmation(
          true,
          "wrongprojectref",
          "abcdefghijklmnopqrst"
        ),
      /Write refused/
    );
    assert.doesNotThrow(() =>
      assertProjectRefConfirmation(
        true,
        "abcdefghijklmnopqrst",
        "abcdefghijklmnopqrst"
      )
    );
  });
});

describe("image dimension migrations", () => {
  it("migration A removes false defaults and allows only paired null or paired positive values", async () => {
    const sql = await readFile(
      new URL("../supabase/migrations/013_image_dimensions_integrity_guard.sql", import.meta.url),
      "utf8"
    );
    assert.match(sql, /alter column width drop default/i);
    assert.match(sql, /alter column height drop default/i);
    assert.match(sql, /width is null and height is null/i);
    assert.match(sql, /width is not null[\s\S]*height is not null[\s\S]*width > 0[\s\S]*height > 0/i);
    assert.match(sql, /not valid/i);
    assert.doesNotMatch(sql, /set default/i);
  });

  it("migration B validates the check before requiring both dimensions", async () => {
    const sql = await readFile(
      new URL("../supabase/migrations/014_image_dimensions_required.sql", import.meta.url),
      "utf8"
    );
    const validateAt = sql.search(/validate constraint/i);
    const notNullAt = sql.search(/alter column width set not null/i);
    assert.ok(validateAt >= 0 && notNullAt > validateAt);
    assert.match(sql, /alter column height set not null/i);
    assert.match(sql, /alter column width drop default/i);
    assert.match(sql, /alter column height drop default/i);
    assert.doesNotMatch(sql, /set default/i);
  });
});
