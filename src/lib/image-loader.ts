interface ImageLoaderProps {
  src: string;
  width: number;
  quality?: number;
}

export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // 本地图片或已带查询参数的 URL 直接返回
  if (src.startsWith("/") || src.includes("?")) {
    return src;
  }

  // 腾讯云 COS 图片：直接返回原图，不通过 Next.js 优化代理
  // 因为 COS 不支持 /_next/image 的 w= q= 参数格式
  if (src.includes("myqcloud.com")) {
    return src;
  }

  // Google 头像等其他外部图片也直接返回
  if (src.startsWith("http")) {
    return src;
  }

  // 兜底：默认行为（理论上不会走到这里）
  const params = new URLSearchParams();
  params.set("url", src);
  params.set("w", width.toString());
  params.set("q", (quality || 75).toString());
  return `/_next/image?${params.toString()}`;
}
