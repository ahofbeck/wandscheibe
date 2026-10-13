import type { NextConfig } from "next";

// Rewrites are resolved at build time, so BACKEND_URL must be set during `next build`
// (Docker: build arg). Local dev falls back to the uvicorn default.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // Standalone server bundle only for the Docker image; `next start` (e.g. Codespaces) needs the default output.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  experimental: { proxyTimeout: 180000 },
  async rewrites() {
    return [
      {
        source: "/api/fe/:path*",
        destination: `${backendUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
