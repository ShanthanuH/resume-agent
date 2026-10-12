import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components is left off: every page here is static or runs in the
  // browser, and the word-diff library reads the clock, which that mode forbids
  // during a static render.
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
