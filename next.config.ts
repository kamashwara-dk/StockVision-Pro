import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CORS headers for API routes — allow the frontend origin to call its own API.
  // In production on Vercel, same-origin requests don't need CORS headers, but
  // this is kept for local development with a separate dev server.
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.NEXT_PUBLIC_APP_URL ?? "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
        ],
      },
    ];
  },

  reactStrictMode: true,
};

export default nextConfig;
