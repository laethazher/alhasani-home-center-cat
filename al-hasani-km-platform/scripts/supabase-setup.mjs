/**
 * إعداد Supabase عبر REST API (دلو الفيديو + فحص الاتصال).
 * يقرأ المفاتيح من .env.local — لا يطبع الأسرار.
 *
 *   node scripts/supabase-setup.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    env[t.slice(0, i).trim()] = v;
  }
}

const base = (env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const bucket = env.SUPABASE_VIDEO_BUCKET || "academy-videos";

if (!base) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL مفقود");
  process.exit(1);
}

console.log("→ Supabase API:", base);
console.log("→ REST endpoint:", `${base}/rest/v1/`);

// 1) فحص REST API — Auth health (لا يحتاج جلسة)
const health = await fetch(`${base}/auth/v1/health`, {
  headers: anonKey ? { apikey: anonKey } : {},
});
console.log(health.ok ? "✓ Auth API يعمل" : `⚠ Auth health: ${health.status}`);

// 2) فحص PostgREST — user_profiles بدون جلسة → 401/403 متوقّع (RLS)
if (anonKey) {
  const url = `${base}/rest/v1/user_profiles?select=id&limit=1`;
  const r = await fetch(url, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (r.ok) console.log("✓ REST API يعمل (user_profiles)");
  else if (r.status === 401 || r.status === 403)
    console.log("✓ REST API متصل — user_profiles محمي بـ RLS (طبيعي بدون تسجيل دخول)");
  else console.log(`⚠ REST: ${r.status} ${await r.text().then((t) => t.slice(0, 120))}`);
} else {
  console.log("⚠ لا مفتاح anon/publishable للفحص");
}

// 3) إنشاء دلو academy-videos (يتطلب service_role)
if (!serviceKey) {
  console.log("⚠ SUPABASE_SERVICE_ROLE_KEY غير موجود — أنشئ دلو academy-videos يدوياً من Dashboard");
  console.log("  https://supabase.com/dashboard/project/jxwzaoogmqzcqgnldwpm/storage/buckets");
  process.exit(0);
}

const list = await fetch(`${base}/storage/v1/bucket`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
if (!list.ok) {
  console.error("✗ Storage API:", list.status, await list.text());
  process.exit(1);
}
const buckets = await list.json();
if (buckets.some((b) => b.name === bucket || b.id === bucket)) {
  console.log(`✓ دلو "${bucket}" موجود`);
} else {
  const create = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: bucket, public: false }),
  });
  if (create.ok) console.log(`✓ دلو "${bucket}" أُنشئ`);
  else console.error("✗ إنشاء الدلو:", create.status, await create.text());
}
