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
      // An item's photograph is usually the one on the page it is sold from,
      // which is the whole premise of the product. These are the two hosts that
      // serve those pictures. Listing images can disappear when a listing ends,
      // so anything meant to last should be uploaded rather than linked.
      { protocol: "https", hostname: "i.ebayimg.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
    ],
  },
};

export default nextConfig;
