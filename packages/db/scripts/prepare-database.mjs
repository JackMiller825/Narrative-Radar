import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is unset, so migrate and seed were skipped.");
  process.exit(0);
}

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = (name) => path.join(packageRoot, "node_modules", ".bin", process.platform === "win32" ? `${name}.cmd` : name);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(bin("prisma"), ["migrate", "deploy"]);
run(bin("tsx"), ["prisma/seed.ts"]);
