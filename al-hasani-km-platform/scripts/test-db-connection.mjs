/**
 * فحص اتصال PostgreSQL (Session pooler) — بدون طباعة كلمة المرور.
 *   npm run db:test
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");

if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const directUrl = process.env.DIRECT_URL || "";
if (!directUrl) {
  console.error("✗ أضف DIRECT_URL في .env.local");
  process.exit(1);
}

delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGHOST;

const client = new pg.Client({
  connectionString: directUrl,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
try {
  console.log(`→ ${directUrl.replace(/:[^:@/]+@/, ":***@")}`);
  await client.connect();
  const r = await client.query(
    "select current_user, (select count(*)::int from information_schema.schemata where schema_name = 'km') as km_schema"
  );
  console.log("✓ اتصال ناجح — المستخدم:", r.rows[0].current_user, "| schema km:", r.rows[0].km_schema === 1 ? "موجود" : "غير موجود");
} catch (e) {
  console.error("✗ فشل الاتصال:", e.message.split("\n")[0]);
  console.error("");
  console.error("  1) Dashboard → Database → Reset database password");
  console.error("  2) حدّث SUPABASE_DB_PASSWORD في .env.local");
  console.error("  3) حدّث DATABASE_URL و DIRECT_URL (استبدل كلمة المرور، ! → %21 في الرابط)");
  process.exit(1);
} finally {
  await client.end();
}
