import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Traced server bundle for the container build, so the image carries the app
  // and the modules it imports rather than the whole node_modules tree. Netlify's
  // adapter decides its own output, so it is left alone there.
  output: process.env.NETLIFY ? undefined : "standalone",
  serverExternalPackages: ["@libsql/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
