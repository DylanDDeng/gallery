import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGalleryImageUrl,
  canTransformGalleryImage,
  getGalleryImageWidth,
} from "../src/lib/gallery-image-loader.ts";

const COS_IMAGE =
  "https://image-1325800846.cos.ap-nanjing.myqcloud.com/gallery/example.png";

test("gallery loader uses stable width buckets and WebP quality", () => {
  assert.equal(getGalleryImageWidth(319), 320);
  assert.equal(getGalleryImageWidth(321), 480);
  assert.equal(getGalleryImageWidth(999), 1200);
  assert.equal(getGalleryImageWidth(9999), 2048);

  assert.equal(
    buildGalleryImageUrl({ src: COS_IMAGE, width: 601, quality: 20 }),
    `${COS_IMAGE}?imageMogr2/thumbnail/640x/format/webp/quality/78`,
  );
  assert.equal(
    buildGalleryImageUrl({ src: COS_IMAGE, width: 601, quality: 99 }),
    `${COS_IMAGE}?imageMogr2/thumbnail/640x/format/webp/quality/82`,
  );
});

test("gallery loader transforms only the exact HTTPS COS host", () => {
  assert.equal(canTransformGalleryImage(COS_IMAGE), true);

  for (const unsafe of [
    "http://image-1325800846.cos.ap-nanjing.myqcloud.com/gallery/example.png",
    "https://image-1325800846.cos.ap-nanjing.myqcloud.com.evil.test/example.png",
    "https://evil.test/image-1325800846.cos.ap-nanjing.myqcloud.com/example.png",
    "https://image-1325800846.cos.ap-nanjing.myqcloud.com:8443/example.png",
    "https://user:password@image-1325800846.cos.ap-nanjing.myqcloud.com/example.png",
    `${COS_IMAGE}?existing=query`,
    `${COS_IMAGE}#fragment`,
    "/local/image.png",
  ]) {
    assert.equal(canTransformGalleryImage(unsafe), false, unsafe);
    assert.equal(buildGalleryImageUrl({ src: unsafe, width: 640 }), unsafe);
  }
});

test("gallery loader feature switch falls back to originals", () => {
  const previous = process.env.NEXT_PUBLIC_GALLERY_COS_TRANSFORMS;
  process.env.NEXT_PUBLIC_GALLERY_COS_TRANSFORMS = "0";
  try {
    assert.equal(canTransformGalleryImage(COS_IMAGE), false);
    assert.equal(buildGalleryImageUrl({ src: COS_IMAGE, width: 640 }), COS_IMAGE);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_GALLERY_COS_TRANSFORMS;
    } else {
      process.env.NEXT_PUBLIC_GALLERY_COS_TRANSFORMS = previous;
    }
  }
});
