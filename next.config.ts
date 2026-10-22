import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The data bank is read from disk at request time, so tell Vercel to ship it
  // with the /api/schemes function.
  outputFileTracingIncludes: {
    "/api/schemes": ["./databank/schemes/*.json", "./databank/registers/*.csv"],
  },
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
