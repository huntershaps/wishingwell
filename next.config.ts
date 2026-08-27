import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Traced server bundle, so the deployed image carries the app and the handful
  // of modules it actually imports rather than the whole node_modules tree.
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
