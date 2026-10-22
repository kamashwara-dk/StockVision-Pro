import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow fetching from Yahoo Finance in server components / route handlers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type",
          },
        ],
      },
    ];
  },
  // Suppress noisy React strict-mode double-render in dev for chart libs
  reactStrictMode: true,
};

export default nextConfig;
