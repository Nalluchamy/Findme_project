import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: true, // Disabled to prevent stale service worker caching issues
  register: false,
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withPWA(nextConfig);
