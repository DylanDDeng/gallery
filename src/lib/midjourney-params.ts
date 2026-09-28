export interface MidjourneyParams {
  version: string | null;
  profiles: string[];
  srefs: string[];
  usesDefaultProfile: boolean;
  aspect: string | null;
  stylize: string | null;
  style: string | null;
  other: Record<string, string>;
}

export interface ParsedMidjourneyPrompt {
  text: string;
  paramsText: string;
  params: MidjourneyParams;
}

export interface MidjourneyColumns {
  mj_version: string | null;
  mj_profiles: string[] | null;
  mj_srefs: string[] | null;
  mj_params: Record<string, string> | null;
}

const PROFILE_FLAGS = new Set(["p", "profile", "personalize"]);
const VERSION_FLAGS = new Set(["v", "version"]);
const ASPECT_FLAGS = new Set(["ar", "aspect"]);
const STYLIZE_FLAGS = new Set(["s", "stylize"]);

// macOS and iOS autocorrect turn "--" into an em dash, which Midjourney accepts.
const PARAM_START = /(?:^|\s)(?:--|—)(?=[a-z])/i;
const FLAG_TOKEN = /^(?:--|—)([a-z][a-z0-9]*)$/i;

export type StyleCodeKind = "p" | "sref";

export function isMidjourneyModel(model: unknown): boolean {
  return typeof model === "string" && /midjourney/i.test(model);
}

// "7" → "V7", "6.1" → "V6.1", "niji 6" → "Niji 6".
export function formatMidjourneyVersion(version: string | null | undefined): string {
  if (!version) return "";
  const niji = /^niji\s*(.*)$/i.exec(version);
  if (niji) return niji[1] ? `Niji ${niji[1]}` : "Niji";
  return /^\d/.test(version) ? `V${version}` : version;
}

export function midjourneyModelLabel(
  model: string,
  version: string | null | undefined
): string {
  const label = formatMidjourneyVersion(version);
  return label ? `${model} ${label}` : model;
}

function emptyParams(): MidjourneyParams {
  return {
    version: null,
    profiles: [],
    srefs: [],
    usesDefaultProfile: false,
    aspect: null,
    stylize: null,
    style: null,
    other: {},
  };
}

// Weights ("123::2") are per-use tuning; the code itself is the category key.
function styleCode(value: string): string | null {
  const code = value.split("::")[0].trim();
  if (!code || /^https?:\/\//i.test(code) || code.toLowerCase() === "random") {
    return null;
  }
  return code;
}

function pushUnique(list: string[], value: string | null) {
  if (value && !list.includes(value)) list.push(value);
}

function applyFlag(params: MidjourneyParams, flag: string, values: string[]) {
  const joined = values.join(" ");

  if (PROFILE_FLAGS.has(flag)) {
    if (values.length === 0) params.usesDefaultProfile = true;
    for (const value of values) pushUnique(params.profiles, styleCode(value));
  } else if (flag === "sref") {
    for (const value of values) pushUnique(params.srefs, styleCode(value));
  } else if (VERSION_FLAGS.has(flag)) {
    if (joined) params.version = joined;
  } else if (flag === "niji") {
    params.version = joined ? `niji ${joined}` : "niji";
  } else if (ASPECT_FLAGS.has(flag)) {
    if (joined) params.aspect = joined;
  } else if (STYLIZE_FLAGS.has(flag)) {
    if (joined) params.stylize = joined;
  } else if (flag === "style") {
    if (joined) params.style = joined;
  } else {
    params.other[flag] = joined;
  }
}

export function parseMidjourneyPrompt(prompt: string): ParsedMidjourneyPrompt {
  const params = emptyParams();
  const match = PARAM_START.exec(prompt);
  if (!match) {
    return { text: prompt.trim(), paramsText: "", params };
  }

  const text = prompt.slice(0, match.index).trim();
  const paramsText = prompt.slice(match.index).trim();

  let flag: string | null = null;
  let values: string[] = [];
  for (const token of paramsText.split(/\s+/)) {
    const flagMatch = FLAG_TOKEN.exec(token);
    if (flagMatch) {
      if (flag) applyFlag(params, flag, values);
      flag = flagMatch[1].toLowerCase();
      values = [];
    } else if (flag) {
      values.push(token);
    }
  }
  if (flag) applyFlag(params, flag, values);

  return { text, paramsText, params };
}

export function midjourneyColumnsFor(
  model: unknown,
  prompt: unknown
): MidjourneyColumns {
  if (!isMidjourneyModel(model) || typeof prompt !== "string") {
    return { mj_version: null, mj_profiles: null, mj_srefs: null, mj_params: null };
  }

  const { params } = parseMidjourneyPrompt(prompt);
  const extra: Record<string, string> = { ...params.other };
  if (params.aspect) extra.ar = params.aspect;
  if (params.stylize) extra.s = params.stylize;
  if (params.style) extra.style = params.style;
  if (params.usesDefaultProfile) extra.p = "";

  return {
    mj_version: params.version,
    mj_profiles: params.profiles,
    mj_srefs: params.srefs,
    mj_params: extra,
  };
}
