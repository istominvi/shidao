import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  images: {
    formats: ["image/webp"],
    qualities: [75, 85],
    deviceSizes: [480, 640, 750, 828, 1080, 1200, 1440, 1920],
    imageSizes: [32, 40, 48, 64, 72, 80, 96, 112, 128, 144, 160, 192, 256, 384],
    minimumCacheTTL: 604_800,
    maximumDiskCacheSize: 268_435_456,
    localPatterns: [
      { pathname: "/avatars/presets/**" },
      { pathname: "/landing/**" },
      { pathname: "/model/**" },
      { pathname: "/store/products/**" },
    ],
  },
};

export default nextConfig;
