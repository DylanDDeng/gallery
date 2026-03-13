import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image-1325800846.cos.ap-nanjing.myqcloud.com",
      },
    ],
  },
};

export default nextConfig;
