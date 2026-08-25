import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: "/fernandez-conde-os",
  assetPrefix: "/fernandez-conde-os/",
  images: { unoptimized: true },
};

export default nextConfig;
