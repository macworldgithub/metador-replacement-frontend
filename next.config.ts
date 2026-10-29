import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep preview builds separate from the running development server's assets.
  distDir: process.env.PORTAL_BUILD_DIR || '.next',
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
