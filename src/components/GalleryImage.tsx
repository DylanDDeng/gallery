"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import galleryImageLoader, {
  canTransformGalleryImage,
} from "@/lib/gallery-image-loader";

type GalleryImageProps = Omit<ImageProps, "loader" | "unoptimized">;

/**
 * Gallery-only responsive COS image. If a transformed rendition fails, only
 * this image retries with its original URL; downloads remain untouched.
 */
export default function GalleryImage({
  src,
  alt,
  onError,
  ...props
}: GalleryImageProps) {
  const source = typeof src === "string" ? src : "";
  const transformable = canTransformGalleryImage(source);
  const [failedTransformSource, setFailedTransformSource] = useState<
    string | null
  >(null);
  const useOriginal = failedTransformSource === source;

  return (
    <Image
      {...props}
      src={src}
      alt={alt}
      loader={galleryImageLoader}
      unoptimized={!transformable || useOriginal}
      onError={(event) => {
        if (transformable && !useOriginal) {
          setFailedTransformSource(source);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
