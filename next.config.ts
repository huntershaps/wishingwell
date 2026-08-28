import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Traced server bundle, so the deployed image carries the app and the handful
  // of modules it actually imports rather than the whole node_modules tree.
  output: "standalone",
  serverExternalPackages: ["@libsql/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Uploads live in Vercel Blob when the app is deployed there.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
