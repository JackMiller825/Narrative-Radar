import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
if (!env.DATABASE_URL) {
  env.DATABASE_URL = "postgresql://placeholder:placeholder@127.0.0.1:5432/narrative_radar";
  console.log("DATABASE_URL is unset. Generating Prisma Client with a placeholder URL. Set a hosted Postgres URL before the site serves traffic.");
}

const bin = path.join(packageRoot, "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const result = spawnSync(bin, ["generate"], {
  cwd: packageRoot,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
