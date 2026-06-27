/**
 * تشغيل موحّد — منفذ واحد (3000):
 *   · المنصّة (Next.js) على /
 *   · نظام المركبات (Vite) على /system
 *
 *   npm run dev:unified
 *   npm run dev:unified:fresh   ← يحذف .next ثم يشغّل (يحل الصفحة البيضاء)
 */
import { spawn, execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const km = path.join(root, "al-hasani-km-platform");
const nextDir = path.join(km, ".next");
const children = [];

function freePort(port) {
  try {
    if (process.platform === "win32") {
      const out = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, { encoding: "utf8" });
      for (const line of out.split("\n")) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && /^\d+$/.test(pid)) {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          } catch {
            /* ignore */
          }
        }
      }
    }
  } catch {
    /* port free */
  }
}

function cleanNextBuild() {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("🧹 حُذف al-hasani-km-platform/.next (كاش Next.js)\n");
  }
}

async function waitFor(url, ms = 45000) {
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
  throw new Error(`timeout waiting for ${url}`);
}

/** يتحقق أن ملفات JS/CSS تُحمَّل — وإلا تظهر صفحة بيضاء */
async function verifyKmStaticAssets() {
  const html = await fetch("http://127.0.0.1:3000/login", { signal: AbortSignal.timeout(8000) }).then((r) =>
    r.text()
  );
  const m = html.match(/src="(\/_next\/static\/chunks\/main-app\.js[^"]*)"/);
  if (!m) return false;
  const chunk = await fetch(`http://127.0.0.1:3000${m[1]}`, { signal: AbortSignal.timeout(8000) });
  return chunk.ok;
}

function run(name, cwd, env) {
  const child = spawn("npm", ["run", "dev"], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    shell: true,
  });
  child.on("exit", (code) => {
    if (code) console.error(`✗ ${name} توقّف (${code})`);
    for (const c of children) {
      try {
        c.kill();
      } catch {
        /* ignore */
      }
    }
    process.exit(code ?? 0);
  });
  children.push(child);
  return child;
}

function killChildren() {
  for (const c of children) {
    try {
      c.kill();
    } catch {
      /* ignore */
    }
  }
  children.length = 0;
}

if (process.env.FRESH_NEXT === "1" || process.argv.includes("--fresh")) cleanNextBuild();

freePort(3000);
freePort(3001);

console.log("→ تشغيل موحّد: http://localhost:3000");
console.log("   المنصّة: /  |  نظام المركبات: /system\n");

run("fleet", root, {
  PORT: "3001",
  VITE_BASE_PATH: "/system/",
  UNIFIED_DEV: "1",
});

(async () => {
  try {
    await waitFor("http://127.0.0.1:3001/system/");
    console.log("✓ نظام المركبات جاهز على 3001/system\n");

    const startKm = () => {
      run("km", km, {
        UNIFIED_DEV: "1",
        FLEET_DEV_URL: "http://127.0.0.1:3001",
      });
    };

    startKm();
    await waitFor("http://127.0.0.1:3000/");

    let assetsOk = false;
    for (let i = 0; i < 8; i++) {
      try {
        assetsOk = await verifyKmStaticAssets();
        if (assetsOk) break;
      } catch {
        /* compile may still be running */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }

    if (!assetsOk) {
      console.warn("⚠ ملفات Next.js الثابتة لا تُحمَّل — إعادة التشغيل بعد تنظيف .next …\n");
      killChildren();
      freePort(3000);
      cleanNextBuild();
      run("fleet", root, { PORT: "3001", VITE_BASE_PATH: "/system/", UNIFIED_DEV: "1" });
      await waitFor("http://127.0.0.1:3001/system/");
      startKm();
      await waitFor("http://127.0.0.1:3000/");
      assetsOk = await verifyKmStaticAssets();
      if (!assetsOk) throw new Error("ملفات Next.js لا تزال تفشل — جرّب: npm run dev:unified:fresh");
    }

    console.log("\n✅ جاهز — افتح http://localhost:3000/login\n");
  } catch (e) {
    console.error("✗", e.message);
    killChildren();
    process.exit(1);
  }
})();

process.on("SIGINT", () => {
  killChildren();
  process.exit(0);
});
