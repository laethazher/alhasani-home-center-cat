/**
 * إنتاج موحّد — منفذ Render واحد:
 *   · Next.js (المنصّة + /academy) على PORT
 *   · نظام المركبات على منفذ داخلي + /system
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const km = path.join(root, "al-hasani-km-platform");

const mainPort = process.env.PORT || "3000";
const fleetPort = process.env.FLEET_INTERNAL_PORT || "10001";
const fleetUrl = `http://127.0.0.1:${fleetPort}`;

let fleetProc;
let nextProc;

function shutdown(code = 0) {
  for (const p of [fleetProc, nextProc]) {
    try {
      p?.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(code);
}

async function waitFor(url, ms = 60000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (r.status < 500) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`timeout: ${url}`);
}

console.log("→ إنتاج موحّد");
console.log(`   المنصّة: PORT ${mainPort}`);
console.log(`   المركبات: ${fleetUrl}/system/\n`);

fleetProc = spawn("node", ["serve.js"], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: fleetPort,
    VITE_BASE_PATH: "/system/",
  },
  stdio: "inherit",
});

fleetProc.on("exit", (code) => {
  if (code) {
    console.error(`✗ نظام المركبات توقّف (${code})`);
    shutdown(code);
  }
});

try {
  await waitFor(`${fleetUrl}/ping`);
  console.log("✓ نظام المركبات جاهز\n");
} catch (e) {
  console.error("✗", e.message);
  shutdown(1);
}

nextProc = spawn("npm", ["start"], {
  cwd: km,
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: mainPort,
    UNIFIED_PROD: "1",
    FLEET_DEV_URL: fleetUrl,
  },
  stdio: "inherit",
  shell: true,
});

nextProc.on("exit", (code) => shutdown(code ?? 0));

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
