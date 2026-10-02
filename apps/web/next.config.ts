import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@radar/core", "@radar/db", "@radar/providers"],
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp", "bullmq", "ioredis"],
};

export default nextConfig;
