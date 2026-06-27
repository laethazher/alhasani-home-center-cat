/**
 * تشغيل bootstrap SQL على Supabase (schema km + trigger المتعلّمين).
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
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
loadEnvLocal();

const config = {
  host: process.env.SUPABASE_DB_HOST || "aws-1-ap-south-1.pooler.supabase.com",
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER || "postgres.jxwzaoogmqzcqgnldwpm",
  password: process.env.SUPABASE_DB_PASSWORD || "",
  database: "postgres",
  ssl: { rejectUnauthorized: false },
};

// منع متغيّرات PG النظامية من تجاوز الإعدادات
delete process.env.PGUSER;
delete process.env.PGPASSWORD;
delete process.env.PGHOST;

if (!config.password) {
  console.error("✗ مطلوب SUPABASE_DB_PASSWORD في .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, "supabase-km-bootstrap.sql"), "utf8");
const client = new pg.Client(config);

try {
  console.log(`→ اتصال: ${config.user}@${config.host}:${config.port}`);
  await client.connect();
  await client.query(sql);
  console.log("✓ bootstrap SQL نُفّذ (CREATE SCHEMA km + trigger المتعلّمين)");
} catch (e) {
  console.error("✗", e.message);
  process.exit(1);
} finally {
  await client.end();
}
