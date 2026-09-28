import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      // Browsers and some crawlers request /favicon.ico by convention; the
      // icon ships as SVG.
      { source: "/favicon.ico", destination: "/favicon.svg", permanent: false },
    ];
  },
  async rewrites() {
    const backendUrl = (process.env.BACKEND_URL || "http://127.0.0.1:3001").replace(/\/+$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
