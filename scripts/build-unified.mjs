/**
 * بناء الإنتاج الموحّد — المركبات (/system) + المنصّة (Next.js)
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const km = path.join(root, "al-hasani-km-platform");
const nextDir = path.join(km, ".next");

function run(label, cmd, args, cwd, env = {}) {
  console.log(`\n→ ${label}…`);
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) {
    console.error(`✗ فشل: ${label}`);
    process.exit(r.status ?? 1);
  }
}

run("Prisma generate", "npm", ["run", "prisma:generate"], km);
run("Fleet build (/system)", "npm", ["run", "build"], root, { VITE_BASE_PATH: "/system/" });
if (fs.existsSync(nextDir)) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log("🧹 حُذف .next قبل بناء المنصّة");
}
run("KM platform build", "npm", ["run", "build"], km);

console.log("\n✅ build:unified اكتمل\n");
