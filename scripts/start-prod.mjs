/**
 * start — على Render يشغّل Next.js + المركبات (/system) تلقائياً.
 * محلياً: serve.js فقط (نظام المركبات standalone).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isUnifiedProduction } from "./render-detect.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

if (isUnifiedProduction()) {
  console.log("→ Render: start موحّد\n");
  const r = spawnSync("node", ["scripts/start-unified.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      UNIFIED_PROD: "1",
      NEXT_PUBLIC_UNIFIED: process.env.NEXT_PUBLIC_UNIFIED || "1",
    },
    stdio: "inherit",
  });
  process.exit(r.status ?? 0);
} else {
  spawnSync("node", ["serve.js"], { cwd: root, stdio: "inherit" });
}
