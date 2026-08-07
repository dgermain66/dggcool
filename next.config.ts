import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't use "standalone" output on Vercel — it's for self-hosting and
  // causes issues with Vercel's build system. Vercel handles output natively.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow cross-origin requests from the Vercel preview domain
  allowedDevOrigins: ["*.vercel.app", "*.space-z.ai"],
};

export default nextConfig;
