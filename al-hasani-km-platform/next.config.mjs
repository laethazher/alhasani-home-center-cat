/** @type {import('next').NextConfig} */
const fleetDev = process.env.FLEET_DEV_URL || "http://127.0.0.1:10001";
const unified =
  process.env.UNIFIED_DEV === "1" || process.env.UNIFIED_PROD === "1";

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  async rewrites() {
    if (!unified) return [];
    return [
      { source: "/system", destination: `${fleetDev}/system/` },
      { source: "/system/:path*", destination: `${fleetDev}/system/:path*` },
      { source: "/api/reports", destination: `${fleetDev}/api/reports` },
      { source: "/api/reports/:path*", destination: `${fleetDev}/api/reports/:path*` },
      { source: "/ping", destination: `${fleetDev}/ping` },
      { source: "/PING", destination: `${fleetDev}/PING` },
    ];
  },
};
export default nextConfig;
