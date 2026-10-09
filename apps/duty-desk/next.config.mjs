/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  // Repair photos are shrunk in the browser first (lib/photo.ts); this is the backstop.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
};

export default nextConfig;
