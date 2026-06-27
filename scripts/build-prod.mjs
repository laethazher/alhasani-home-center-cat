/**
 * build — على Render يبني المنصّة + المركبات (/system) تلقائياً.
 * محلياً: vite build فقط (نظام المركبات).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isUnifiedProduction } from "./render-detect.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const km = path.join(root, "al-hasani-km-platform");

function run(cmd, args, cwd, env = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: true,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (isUnifiedProduction()) {
  console.log("→ Render: build موحّد (المنصّة + /system)\n");
  run("npm", ["install"], km);
  run("node", ["scripts/build-unified.mjs"], root);
} else {
  run("npm", ["run", "build:fleet"], root);
}
