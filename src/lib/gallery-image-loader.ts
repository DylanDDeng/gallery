import type { ImageLoaderProps } from "next/image";

export const GALLERY_COS_HOSTNAME =
  "image-1325800846.cos.ap-nanjing.myqcloud.com";
export const GALLERY_IMAGE_WIDTH_BUCKETS = [
  320, 480, 640, 800, 960, 1200, 1600, 1920, 2048,
] as const;

const DEFAULT_QUALITY = 80;

export function galleryCosTransformsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GALLERY_COS_TRANSFORMS !== "0";
}

export function canTransformGalleryImage(src: string): boolean {
  if (!galleryCosTransformsEnabled()) return false;

  try {
    const url = new URL(src);
    return (
      url.protocol === "https:" &&
      url.hostname === GALLERY_COS_HOSTNAME &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function getGalleryImageWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) {
    return GALLERY_IMAGE_WIDTH_BUCKETS[0];
  }

  return (
    GALLERY_IMAGE_WIDTH_BUCKETS.find((bucket) => bucket >= width) ??
    GALLERY_IMAGE_WIDTH_BUCKETS[GALLERY_IMAGE_WIDTH_BUCKETS.length - 1]
  );
}

export function buildGalleryImageUrl({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (!canTransformGalleryImage(src)) return src;

  const url = new URL(src);
  const targetWidth = getGalleryImageWidth(width);
  const targetQuality = Math.min(
    82,
    Math.max(78, Number.isFinite(quality) ? Math.round(quality!) : DEFAULT_QUALITY),
  );

  return `${url.origin}${url.pathname}?imageMogr2/thumbnail/${targetWidth}x/format/webp/quality/${targetQuality}`;
}

export default function galleryImageLoader(props: ImageLoaderProps): string {
  return buildGalleryImageUrl(props);
}
