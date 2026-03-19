type ImageWithDimensions = {
  url: string;
  width: number | null;
  height: number | null;
};

type ImageDimensions = {
  width: number;
  height: number;
};

const dimensionCache = new Map<string, ImageDimensions>();
const pendingDimensionLoads = new Map<string, Promise<ImageDimensions | null>>();

function loadImageDimensions(url: string): Promise<ImageDimensions | null> {
  if (!url || typeof window === "undefined") {
    return Promise.resolve(null);
  }

  const cached = dimensionCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingDimensionLoads.get(url);
  if (pending) {
    return pending;
  }

  const request = new Promise<ImageDimensions | null>((resolve) => {
    const img = new window.Image();

    img.decoding = "async";
    img.onload = () => {
      const dimensions =
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? { width: img.naturalWidth, height: img.naturalHeight }
          : null;

      if (dimensions) {
        dimensionCache.set(url, dimensions);
      }

      pendingDimensionLoads.delete(url);
      resolve(dimensions);
    };
    img.onerror = () => {
      pendingDimensionLoads.delete(url);
      resolve(null);
    };
    img.src = url;
  });

  pendingDimensionLoads.set(url, request);
  return request;
}

export async function hydrateImageDimensions<T extends ImageWithDimensions>(
  images: T[]
): Promise<T[]> {
  const missingImages = images.filter((image) => !image.width || !image.height);

  if (missingImages.length === 0 || typeof window === "undefined") {
    return images;
  }

  const uniqueUrls = Array.from(new Set(missingImages.map((image) => image.url)));
  const resolved = await Promise.all(
    uniqueUrls.map(async (url) => [url, await loadImageDimensions(url)] as const)
  );
  const dimensionsByUrl = new Map(
    resolved.filter((entry): entry is readonly [string, ImageDimensions] => entry[1] !== null)
  );

  return images.map((image) => {
    if (image.width && image.height) {
      return image;
    }

    const dimensions = dimensionsByUrl.get(image.url);
    return dimensions ? { ...image, ...dimensions } : image;
  });
}
