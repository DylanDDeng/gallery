import { createHash } from "node:crypto";
import { chmod, mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { resolveCosImageDimensions } from "../src/lib/cos-image-metadata-core.ts";

export type ImageId = string | number;

export interface ImageRow extends Record<string, unknown> {
  id: ImageId;
  url: string;
  width: number | null;
  height: number | null;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface BackfillEntry extends ImageDimensions {
  id: ImageId;
  imageUrl: string;
  widthBefore: null;
  heightBefore: null;
  nonDimensionHash: string;
}

export interface BackfillManifest {
  version: 1;
  projectRef: string;
  createdAt: string;
  mode: "dry-run" | "apply";
  totalRowsAtSnapshot: number;
  missingRowsAtSnapshot: number;
  entries: BackfillEntry[];
}

export interface BackfillVerification {
  totalRows: number;
  missingDimensions: number;
  partialDimensions: number;
  verifiedEntries: number;
}

export interface BackfillResult {
  manifest: BackfillManifest;
  updatedRows: number;
  verification: BackfillVerification | null;
}

export interface RollbackResult {
  revertedRows: number;
  conflicts: number;
}

export interface JournalEvent extends Record<string, unknown> {
  at: string;
  event: string;
}

export interface ImagesGateway {
  /** Returns one frozen, complete snapshot. No mutation may begin before it resolves. */
  listAllSnapshot(): Promise<ImageRow[]>;
  setDimensionsIfMissing(entry: BackfillEntry): Promise<boolean>;
  clearDimensionsIfUnchanged(entry: BackfillEntry): Promise<boolean>;
}

export type DimensionsResolver = (imageUrl: string) => Promise<ImageDimensions>;
export type JournalWriter = (event: JournalEvent) => Promise<void>;

const DEFAULT_WRITE_CONCURRENCY = 5;
const DEFAULT_PREFLIGHT_CONCURRENCY = 5;
const CANARY_SIZE = 10;
const PAGE_SIZE = 500;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function hashNonDimensionFields(row: ImageRow): string {
  const otherFields = Object.fromEntries(
    Object.entries(row).filter(([key]) => key !== "width" && key !== "height")
  );
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(otherFields)))
    .digest("hex");
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function assertValidImageRow(value: unknown, index: number): asserts value is ImageRow {
  if (!value || typeof value !== "object") {
    throw new Error(`Snapshot row ${index} is not an object`);
  }
  const row = value as Record<string, unknown>;
  if ((typeof row.id !== "string" && typeof row.id !== "number") || row.id === "") {
    throw new Error(`Snapshot row ${index} has an invalid id`);
  }
  if (typeof row.url !== "string" || row.url.length === 0) {
    throw new Error(`Snapshot row ${index} has an invalid url`);
  }
  if (row.width !== null && !isPositiveSafeInteger(row.width)) {
    throw new Error(`Snapshot row ${index} has an invalid width`);
  }
  if (row.height !== null && !isPositiveSafeInteger(row.height)) {
    throw new Error(`Snapshot row ${index} has an invalid height`);
  }
}

function assertUniqueIds(rows: ImageRow[]): void {
  const ids = new Set<string>();
  for (const row of rows) {
    const key = `${typeof row.id}:${String(row.id)}`;
    if (ids.has(key)) {
      throw new Error("Snapshot contains duplicate image ids");
    }
    ids.add(key);
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error("Concurrency must be a positive integer");
  }
  const output = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(values.length, 1)) },
    async () => {
      while (cursor < values.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await mapper(values[index], index);
      }
    }
  );
  await Promise.all(workers);
  return output;
}

export async function prepareBackfillManifest(options: {
  allRows: ImageRow[];
  projectRef: string;
  apply: boolean;
  resolveDimensions: DimensionsResolver;
  preflightConcurrency?: number;
  now?: () => Date;
}): Promise<BackfillManifest> {
  const {
    allRows,
    projectRef,
    apply,
    resolveDimensions,
    preflightConcurrency = DEFAULT_PREFLIGHT_CONCURRENCY,
    now = () => new Date(),
  } = options;

  allRows.forEach(assertValidImageRow);
  assertUniqueIds(allRows);

  const partialRows = allRows.filter(
    (row) => (row.width === null) !== (row.height === null)
  );
  if (partialRows.length > 0) {
    throw new Error(
      `Preflight refused: ${partialRows.length} rows have only one dimension populated`
    );
  }

  const missingRows = allRows.filter(
    (row) => row.width === null && row.height === null
  );
  const outcomes = await mapWithConcurrency(
    missingRows,
    preflightConcurrency,
    async (row) => {
      try {
        const dimensions = await resolveDimensions(row.url);
        if (
          !isPositiveSafeInteger(dimensions.width) ||
          !isPositiveSafeInteger(dimensions.height)
        ) {
          throw new Error("resolver returned invalid dimensions");
        }
        return { row, dimensions, error: null };
      } catch (error) {
        return {
          row,
          dimensions: null,
          error: error instanceof Error ? error.message : "unknown metadata error",
        };
      }
    }
  );

  const failures = outcomes.filter((outcome) => outcome.error !== null);
  if (failures.length > 0) {
    throw new Error(
      `Metadata preflight failed for ${failures.length}/${missingRows.length} rows; no database writes were attempted`
    );
  }

  const entries: BackfillEntry[] = outcomes.map(({ row, dimensions }) => {
    if (!dimensions) {
      throw new Error("Internal preflight invariant failed");
    }
    return {
      id: row.id,
      imageUrl: row.url,
      widthBefore: null,
      heightBefore: null,
      width: dimensions.width,
      height: dimensions.height,
      nonDimensionHash: hashNonDimensionFields(row),
    };
  });

  return {
    version: 1,
    projectRef,
    createdAt: now().toISOString(),
    mode: apply ? "apply" : "dry-run",
    totalRowsAtSnapshot: allRows.length,
    missingRowsAtSnapshot: missingRows.length,
    entries,
  };
}

async function applyStage(options: {
  name: "canary" | "remaining";
  entries: BackfillEntry[];
  gateway: ImagesGateway;
  concurrency: number;
  journal: JournalWriter;
}): Promise<number> {
  const { name, entries, gateway, concurrency, journal } = options;
  const results = await mapWithConcurrency(entries, concurrency, async (entry) => {
    try {
      const updated = await gateway.setDimensionsIfMissing(entry);
      await journal({
        at: new Date().toISOString(),
        event: updated ? "row-updated" : "row-conflict",
        stage: name,
        id: entry.id,
      });
      return updated;
    } catch (error) {
      await journal({
        at: new Date().toISOString(),
        event: "row-error",
        stage: name,
        id: entry.id,
        message: error instanceof Error ? error.message : "unknown write error",
      });
      return false;
    }
  });
  const updated = results.filter(Boolean).length;
  if (updated !== entries.length) {
    throw new Error(
      `${name} stage updated ${updated}/${entries.length} rows; zero-row updates are conflicts and the run is safely rerunnable`
    );
  }
  return updated;
}

function findRow(rows: ImageRow[], id: ImageId): ImageRow | undefined {
  return rows.find(
    (row) => typeof row.id === typeof id && String(row.id) === String(id)
  );
}

export function verifyManifestAgainstSnapshot(
  manifest: BackfillManifest,
  currentRows: ImageRow[]
): BackfillVerification {
  currentRows.forEach(assertValidImageRow);
  assertUniqueIds(currentRows);
  if (currentRows.length !== manifest.totalRowsAtSnapshot) {
    throw new Error(
      `Verification failed: row count changed from ${manifest.totalRowsAtSnapshot} to ${currentRows.length}`
    );
  }

  let partialDimensions = 0;
  let missingDimensions = 0;
  for (const row of currentRows) {
    if ((row.width === null) !== (row.height === null)) {
      partialDimensions += 1;
    }
    if (row.width === null || row.height === null) {
      missingDimensions += 1;
    }
  }

  for (const entry of manifest.entries) {
    const row = findRow(currentRows, entry.id);
    if (!row) {
      throw new Error("Verification failed: a manifest row disappeared");
    }
    if (
      row.url !== entry.imageUrl ||
      row.width !== entry.width ||
      row.height !== entry.height
    ) {
      throw new Error("Verification failed: a manifest row does not match its source metadata");
    }
    if (hashNonDimensionFields(row) !== entry.nonDimensionHash) {
      throw new Error("Verification failed: non-dimension fields changed");
    }
  }

  if (partialDimensions !== 0 || missingDimensions !== 0) {
    throw new Error(
      `Verification failed: ${missingDimensions} rows are missing dimensions and ${partialDimensions} are partial`
    );
  }

  return {
    totalRows: currentRows.length,
    missingDimensions,
    partialDimensions,
    verifiedEntries: manifest.entries.length,
  };
}

export async function runBackfill(options: {
  gateway: ImagesGateway;
  projectRef: string;
  apply?: boolean;
  resolveDimensions: DimensionsResolver;
  preflightConcurrency?: number;
  writeConcurrency?: number;
  journal?: JournalWriter;
  onPrepared?: (manifest: BackfillManifest) => Promise<void>;
  now?: () => Date;
}): Promise<BackfillResult> {
  const {
    gateway,
    projectRef,
    apply = false,
    resolveDimensions,
    preflightConcurrency,
    writeConcurrency = DEFAULT_WRITE_CONCURRENCY,
    journal = async () => undefined,
    onPrepared = async () => undefined,
    now,
  } = options;

  // This is deliberately the only list operation before writes. It freezes the
  // target set and avoids mutating a result set while offset-paging through it.
  const allRows = await gateway.listAllSnapshot();
  const manifest = await prepareBackfillManifest({
    allRows,
    projectRef,
    apply,
    resolveDimensions,
    preflightConcurrency,
    now,
  });
  await onPrepared(manifest);
  await journal({
    at: new Date().toISOString(),
    event: "preflight-complete",
    totalRows: manifest.totalRowsAtSnapshot,
    targetRows: manifest.entries.length,
    mode: manifest.mode,
  });

  if (!apply) {
    return { manifest, updatedRows: 0, verification: null };
  }

  const canaryEntries = manifest.entries.slice(0, CANARY_SIZE);
  const remainingEntries = manifest.entries.slice(CANARY_SIZE);
  let updatedRows = 0;

  updatedRows += await applyStage({
    name: "canary",
    entries: canaryEntries,
    gateway,
    concurrency: Math.min(writeConcurrency, CANARY_SIZE),
    journal,
  });

  // Verify the ten-row canary against a fresh complete read before proceeding.
  if (canaryEntries.length > 0) {
    const afterCanary = await gateway.listAllSnapshot();
    for (const entry of canaryEntries) {
      const row = findRow(afterCanary, entry.id);
      if (
        !row ||
        row.url !== entry.imageUrl ||
        row.width !== entry.width ||
        row.height !== entry.height ||
        hashNonDimensionFields(row) !== entry.nonDimensionHash
      ) {
        throw new Error("Canary verification failed; remaining writes were not attempted");
      }
    }
    await journal({
      at: new Date().toISOString(),
      event: "canary-verified",
      rows: canaryEntries.length,
    });
  }

  updatedRows += await applyStage({
    name: "remaining",
    entries: remainingEntries,
    gateway,
    concurrency: writeConcurrency,
    journal,
  });

  const currentRows = await gateway.listAllSnapshot();
  const verification = verifyManifestAgainstSnapshot(manifest, currentRows);
  await journal({
    at: new Date().toISOString(),
    event: "verification-complete",
    ...verification,
  });
  return { manifest, updatedRows, verification };
}

export async function rollbackFromManifest(options: {
  gateway: ImagesGateway;
  manifest: BackfillManifest;
  concurrency?: number;
  journal?: JournalWriter;
}): Promise<RollbackResult> {
  const {
    gateway,
    manifest,
    concurrency = DEFAULT_WRITE_CONCURRENCY,
    journal = async () => undefined,
  } = options;
  const currentRows = await gateway.listAllSnapshot();
  const eligible = manifest.entries.filter((entry) => {
    const row = findRow(currentRows, entry.id);
    return (
      row?.url === entry.imageUrl &&
      row.width === entry.width &&
      row.height === entry.height
    );
  });
  const ineligible = manifest.entries.length - eligible.length;
  const results = await mapWithConcurrency(eligible, concurrency, async (entry) => {
    try {
      const reverted = await gateway.clearDimensionsIfUnchanged(entry);
      await journal({
        at: new Date().toISOString(),
        event: reverted ? "row-reverted" : "rollback-conflict",
        id: entry.id,
      });
      return reverted;
    } catch (error) {
      await journal({
        at: new Date().toISOString(),
        event: "rollback-error",
        id: entry.id,
        message: error instanceof Error ? error.message : "unknown rollback error",
      });
      return false;
    }
  });
  const revertedRows = results.filter(Boolean).length;
  return {
    revertedRows,
    conflicts: ineligible + eligible.length - revertedRows,
  };
}

function normalizeSupabaseRows(data: unknown): ImageRow[] {
  if (!Array.isArray(data)) {
    throw new Error("Supabase returned a non-array images response");
  }
  data.forEach(assertValidImageRow);
  return data;
}

export class SupabaseImagesGateway implements ImagesGateway {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async listAllSnapshot(): Promise<ImageRow[]> {
    const rows: ImageRow[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await this.client
        .from("images")
        .select("*")
        .order("id", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        throw new Error(`Could not read images snapshot: ${error.message}`);
      }
      const page = normalizeSupabaseRows(data);
      rows.push(...page);
      if (page.length < PAGE_SIZE) {
        return rows;
      }
    }
  }

  async setDimensionsIfMissing(entry: BackfillEntry): Promise<boolean> {
    const { data, error } = await this.client
      .from("images")
      .update({ width: entry.width, height: entry.height })
      .eq("id", entry.id)
      .eq("url", entry.imageUrl)
      .is("width", null)
      .is("height", null)
      .select("id");
    if (error) {
      throw new Error(`Could not update image dimensions: ${error.message}`);
    }
    return Array.isArray(data) && data.length === 1;
  }

  async clearDimensionsIfUnchanged(entry: BackfillEntry): Promise<boolean> {
    const { data, error } = await this.client
      .from("images")
      .update({ width: null, height: null })
      .eq("id", entry.id)
      .eq("url", entry.imageUrl)
      .eq("width", entry.width)
      .eq("height", entry.height)
      .select("id");
    if (error) {
      throw new Error(
        `Could not conditionally roll back image dimensions: ${error.message}`
      );
    }
    return Array.isArray(data) && data.length === 1;
  }
}

interface CliOptions {
  apply: boolean;
  rollback: boolean;
  manifestPath: string | null;
  confirmProjectRef: string | null;
  artifactDir: string;
  concurrency: number;
}

function parseValueArgument(args: string[], index: number, name: string): [string, number] {
  const arg = args[index];
  const prefix = `${name}=`;
  if (arg.startsWith(prefix)) {
    return [arg.slice(prefix.length), index];
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name} requires a value`);
  }
  return [value, index + 1];
}

export function parseCliArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    apply: false,
    rollback: false,
    manifestPath: null,
    confirmProjectRef: null,
    artifactDir: resolve(".backfill/image-dimensions"),
    concurrency: DEFAULT_WRITE_CONCURRENCY,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--rollback") {
      options.rollback = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (arg === "--manifest" || arg.startsWith("--manifest=")) {
      [options.manifestPath, index] = parseValueArgument(args, index, "--manifest");
    } else if (
      arg === "--confirm-project-ref" ||
      arg.startsWith("--confirm-project-ref=")
    ) {
      [options.confirmProjectRef, index] = parseValueArgument(
        args,
        index,
        "--confirm-project-ref"
      );
    } else if (arg === "--artifact-dir" || arg.startsWith("--artifact-dir=")) {
      [options.artifactDir, index] = parseValueArgument(args, index, "--artifact-dir");
      options.artifactDir = resolve(options.artifactDir);
    } else if (arg === "--concurrency" || arg.startsWith("--concurrency=")) {
      const [value, nextIndex] = parseValueArgument(args, index, "--concurrency");
      index = nextIndex;
      options.concurrency = Number(value);
      if (!Number.isSafeInteger(options.concurrency) || options.concurrency < 1) {
        throw new Error("--concurrency must be a positive integer");
      }
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.rollback && !options.manifestPath) {
    throw new Error("--rollback requires --manifest");
  }
  if (options.rollback && !options.apply) {
    throw new Error("Rollback is a write and requires explicit --apply");
  }
  return options;
}

function printHelp(): void {
  console.log(`Usage:
  npm run backfill:image-dimensions
    Dry-run: snapshot rows, fetch and validate all missing metadata, write a local manifest, no DB writes.

  npm run backfill:image-dimensions -- --apply --confirm-project-ref <ref>
    Apply: preflight every target, write 10 canaries, verify, write the remainder, verify again.

  npm run backfill:image-dimensions -- --rollback --apply --manifest <file> --confirm-project-ref <ref>
    Conditional rollback: clears only rows whose id, URL, width, and height still match the manifest.
    Drop NOT NULL first if migration 014 has already been applied.`);
}

function tryLoadLocalEnvironment(): void {
  const loadEnvFile = (
    process as NodeJS.Process & { loadEnvFile?: (path?: string) => void }
  ).loadEnvFile;
  if (!loadEnvFile) {
    return;
  }
  for (const path of [resolve(".env.local"), resolve(".env")]) {
    try {
      loadEnvFile(path);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
    }
  }
}

export function projectRefFromSupabaseUrl(urlString: string): string {
  const url = new URL(urlString);
  const suffix = ".supabase.co";
  if (url.protocol !== "https:" || !url.hostname.endsWith(suffix)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a standard HTTPS Supabase project URL");
  }
  const projectRef = url.hostname.slice(0, -suffix.length);
  if (!/^[a-z0-9]{10,40}$/.test(projectRef)) {
    throw new Error("Could not derive a valid Supabase project ref");
  }
  return projectRef;
}

export function assertProjectRefConfirmation(
  apply: boolean,
  confirmedProjectRef: string | null,
  actualProjectRef: string
): void {
  if (!apply) {
    return;
  }
  if (confirmedProjectRef !== actualProjectRef) {
    throw new Error(
      "Write refused: --confirm-project-ref must exactly match the project ref derived from NEXT_PUBLIC_SUPABASE_URL"
    );
  }
}

function safeTimestamp(): string {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

async function createArtifactPaths(
  artifactDir: string,
  projectRef: string,
  operation: "backfill" | "rollback"
): Promise<{ manifestPath: string; journalPath: string }> {
  await mkdir(artifactDir, { recursive: true, mode: 0o700 });
  const prefix = `${safeTimestamp()}-${projectRef}-${operation}`;
  const manifestPath = resolve(artifactDir, `${prefix}-manifest.json`);
  const journalPath = resolve(artifactDir, `${prefix}-journal.jsonl`);
  await writeFile(journalPath, "", { encoding: "utf8", mode: 0o600, flag: "wx" });
  await chmod(journalPath, 0o600);
  return { manifestPath, journalPath };
}

function fileJournal(path: string): JournalWriter {
  return async (event) => {
    await appendFile(path, `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
  };
}

async function writeManifest(path: string, manifest: BackfillManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await chmod(path, 0o600);
}

function assertManifest(value: unknown): asserts value is BackfillManifest {
  if (!value || typeof value !== "object") {
    throw new Error("Manifest is not an object");
  }
  const candidate = value as Partial<BackfillManifest>;
  if (
    candidate.version !== 1 ||
    typeof candidate.projectRef !== "string" ||
    !Array.isArray(candidate.entries)
  ) {
    throw new Error("Unsupported or invalid manifest");
  }
  for (const [index, entry] of candidate.entries.entries()) {
    if (
      !entry ||
      (typeof entry.id !== "string" && typeof entry.id !== "number") ||
      typeof entry.imageUrl !== "string" ||
      !isPositiveSafeInteger(entry.width) ||
      !isPositiveSafeInteger(entry.height) ||
      typeof entry.nonDimensionHash !== "string"
    ) {
      throw new Error(`Manifest entry ${index} is invalid`);
    }
  }
}

async function readManifest(path: string): Promise<BackfillManifest> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  assertManifest(value);
  return value;
}

async function main(): Promise<void> {
  tryLoadLocalEnvironment();
  const options = parseCliArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }
  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  assertProjectRefConfirmation(
    options.apply,
    options.confirmProjectRef,
    projectRef
  );
  const gateway = new SupabaseImagesGateway(
    createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  );

  if (options.rollback) {
    const manifest = await readManifest(resolve(options.manifestPath ?? ""));
    if (manifest.projectRef !== projectRef) {
      throw new Error("Manifest project ref does not match the configured project");
    }
    const paths = await createArtifactPaths(options.artifactDir, projectRef, "rollback");
    const result = await rollbackFromManifest({
      gateway,
      manifest,
      concurrency: options.concurrency,
      journal: fileJournal(paths.journalPath),
    });
    console.log(
      `Rollback finished: ${result.revertedRows} reverted, ${result.conflicts} conflicts. Journal: ${paths.journalPath}`
    );
    if (result.conflicts > 0) {
      process.exitCode = 1;
    }
    return;
  }

  const paths = await createArtifactPaths(options.artifactDir, projectRef, "backfill");
  const result = await runBackfill({
    gateway,
    projectRef,
    apply: options.apply,
    resolveDimensions: resolveCosImageDimensions,
    preflightConcurrency: options.concurrency,
    writeConcurrency: options.concurrency,
    journal: fileJournal(paths.journalPath),
    onPrepared: async (manifest) => writeManifest(paths.manifestPath, manifest),
  });
  console.log(
    `${options.apply ? "Apply" : "Dry-run"} finished: ${result.manifest.entries.length} targets, ${result.updatedRows} updates. Manifest: ${paths.manifestPath}. Journal: ${paths.journalPath}`
  );
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isDirectExecution()) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown backfill failure";
    console.error(`Image dimension backfill failed: ${message}`);
    process.exitCode = 1;
  });
}
