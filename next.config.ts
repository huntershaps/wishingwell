import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Traced server bundle for the container build, so the image carries the app
  // and the modules it imports rather than the whole node_modules tree. Vercel
  // and Netlify each decide their own output, so it is left alone on both.
  output: process.env.VERCEL || process.env.NETLIFY ? undefined : "standalone",
  serverExternalPackages: ["@libsql/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Uploads land here when the app is deployed on Vercel.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
