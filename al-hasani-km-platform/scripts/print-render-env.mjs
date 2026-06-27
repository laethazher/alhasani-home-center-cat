/**
 * يطبع متغيّرات Render المطلوبة من .env.local (شغّله محلياً فقط — لا يُرفع الأسرار).
 *
 *   node scripts/print-render-env.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(dir, "..", ".env.local");

const RENDER_KEYS = [
  "AUTH_PROVIDER",
  "NEXT_PUBLIC_AUTH_PROVIDER",
  "NEXT_PUBLIC_DEMO_MODE",
  "NEXT_PUBLIC_UNIFIED",
  "UNIFIED_PROD",
  "FLEET_INTERNAL_PORT",
  "JWT_SECRET",
  "JWT_ISSUER",
  "SESSION_TTL_HOURS",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATABASE_URL",
  "DIRECT_URL",
  "EMBEDDINGS_PROVIDER",
  "EMBEDDING_DIM",
  "GEMINI_API_KEY",
  "SUPABASE_VIDEO_BUCKET",
  "NEXT_PUBLIC_SYSTEM_URL",
];

function parseEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

if (!fs.existsSync(envPath)) {
  console.error("✗ لم يُعثر على .env.local");
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, "utf8"));

console.log("# انسخ إلى Render → alhasani-home-center-cat → Environment\n");
console.log("# إنتاج موحّد — سيرفر واحد:");
console.log("NEXT_PUBLIC_UNIFIED=1");
console.log("UNIFIED_PROD=1");
console.log("NEXT_PUBLIC_SYSTEM_URL=/system");
console.log("FLEET_INTERNAL_PORT=10001\n");

const missing = [];
for (const key of RENDER_KEYS) {
  let val = env[key];
  if (key === "NEXT_PUBLIC_SYSTEM_URL") {
    val = "/system";
  }
  if (key === "NEXT_PUBLIC_UNIFIED") val = val || "1";
  if (key === "UNIFIED_PROD") val = val || "1";
  if (key === "FLEET_INTERNAL_PORT") val = val || "10001";
  if (!val) {
    missing.push(key);
    continue;
  }
  console.log(`${key}=${val}`);
}

if (missing.length) {
  console.error("\n⚠ ناقص في .env.local:", missing.join(", "));
  process.exit(1);
}

console.log("\n✅ جاهز للنسخ إلى Render Dashboard");
