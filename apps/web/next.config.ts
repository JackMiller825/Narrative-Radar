import type { NextConfig } from "next";

const githubPages = process.env.GITHUB_PAGES === "1";

const nextConfig: NextConfig = {
  transpilePackages: ["@radar/core", "@radar/db", "@radar/providers"],
  serverExternalPackages: ["@prisma/client", "sharp", "bullmq", "ioredis"],
  ...(githubPages
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
