export const OUTPUT_RESOLUTIONS = [
  { id: "2K", label: "2K" },
  { id: "3K", label: "3K" },
] as const;

export const ASPECT_RATIO_OPTIONS = [
  { id: "1:1", label: "1:1" },
  { id: "3:4", label: "3:4" },
  { id: "4:3", label: "4:3" },
  { id: "16:9", label: "16:9" },
  { id: "9:16", label: "9:16" },
  { id: "3:2", label: "3:2" },
  { id: "2:3", label: "2:3" },
  { id: "21:9", label: "21:9" },
] as const;

export type OutputResolution = (typeof OUTPUT_RESOLUTIONS)[number]["id"];
export type AspectRatio = (typeof ASPECT_RATIO_OPTIONS)[number]["id"];

type OutputSize = {
  size: string;
  width: number;
  height: number;
};

const OUTPUT_SIZE_MAP: Record<OutputResolution, Record<AspectRatio, OutputSize>> = {
  "2K": {
    "1:1": { size: "2048x2048", width: 2048, height: 2048 },
    "3:4": { size: "1728x2304", width: 1728, height: 2304 },
    "4:3": { size: "2304x1728", width: 2304, height: 1728 },
    "16:9": { size: "2848x1600", width: 2848, height: 1600 },
    "9:16": { size: "1600x2848", width: 1600, height: 2848 },
    "3:2": { size: "2496x1664", width: 2496, height: 1664 },
    "2:3": { size: "1664x2496", width: 1664, height: 2496 },
    "21:9": { size: "3136x1344", width: 3136, height: 1344 },
  },
  "3K": {
    "1:1": { size: "3072x3072", width: 3072, height: 3072 },
    "3:4": { size: "2592x3456", width: 2592, height: 3456 },
    "4:3": { size: "3456x2592", width: 3456, height: 2592 },
    "16:9": { size: "4096x2304", width: 4096, height: 2304 },
    "9:16": { size: "2304x4096", width: 2304, height: 4096 },
    "3:2": { size: "3744x2496", width: 3744, height: 2496 },
    "2:3": { size: "2496x3744", width: 2496, height: 3744 },
    "21:9": { size: "4704x2016", width: 4704, height: 2016 },
  },
};

export function getOutputSize(
  resolution: OutputResolution,
  aspectRatio: AspectRatio
) {
  return OUTPUT_SIZE_MAP[resolution][aspectRatio];
}
