import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  env: {
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  },
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
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
