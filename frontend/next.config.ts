import type { NextConfig } from "next";

// Rewrites are resolved at build time, so BACKEND_URL must be set during `next build`
// (Docker: build arg). Local dev falls back to the uvicorn default.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
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
