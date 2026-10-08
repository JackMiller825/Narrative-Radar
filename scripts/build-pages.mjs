import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "web", "app", "api");
const stashDir = path.join(root, "apps", "web", ".api-pages-stash");
const layoutPath = path.join(root, "apps", "web", "app", "(desk)", "layout.tsx");
const narrativePath = path.join(root, "apps", "web", "app", "(desk)", "radar", "[id]", "page.tsx");
const dynamicExport = 'export const dynamic = "force-dynamic";';
const staticExport = 'export const dynamic = "force-static";';
const dynamicParams = "export const dynamicParams = true;";
const staticParams = "export const dynamicParams = false;";

const originalLayout = readFileSync(layoutPath, "utf8");
const originalNarrative = readFileSync(narrativePath, "utf8");
if (!originalLayout.includes(dynamicExport) || !originalNarrative.includes(dynamicParams)) {
  console.error("Pages build could not find the server rendering switches to rewrite.");
  process.exit(1);
}

if (existsSync(stashDir)) {
  console.error("A previous Pages build left apps/web/.api-pages-stash in place. Move it back to apps/web/app/api before retrying.");
  process.exit(1);
}

let moved = false;
let status = 1;
try {
  renameSync(apiDir, stashDir);
  moved = true;
  writeFileSync(layoutPath, originalLayout.replace(dynamicExport, staticExport));
  writeFileSync(narrativePath, originalNarrative.replace(dynamicParams, staticParams));
  const result = spawnSync("pnpm", ["--filter", "@radar/web...", "run", "build"], {
    cwd: root,
    env: { ...process.env, GITHUB_PAGES: "1" },
    stdio: "inherit",
    shell: true,
  });
  status = result.status ?? 1;
} finally {
  writeFileSync(layoutPath, originalLayout);
  writeFileSync(narrativePath, originalNarrative);
  if (moved && existsSync(stashDir) && !existsSync(apiDir)) renameSync(stashDir, apiDir);
}
process.exit(status);
