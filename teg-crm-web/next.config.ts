import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server.js + minimal deps.
  // Required for the Dockerfile multi-stage runner image (no full node_modules).
  output: "standalone",
};

export default nextConfig;
