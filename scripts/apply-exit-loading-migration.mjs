/**
 * يطبّق ترحيل أعمدة احتساب وقت التحميل على قاعدة بيانات Supabase.
 * يحتاج متغير بيئة SUPABASE_DB_URL (أو DATABASE_URL) = سلسلة اتصال Postgres كاملة من لوحة Supabase.
 *
 * المسار: Supabase Dashboard → Project Settings → Database → Connection string → URI
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL;

if (!connectionString || !connectionString.startsWith('postgres')) {
  console.error(`
❌ لم يُعثر على سلسلة اتصال Postgres.

أضف في ملف .env (في جذر المشروع) سطراً مثل:

  SUPABASE_DB_URL="postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres"

انسخ القيمة من: Supabase → إعدادات المشروع → Database → Connection string → URI
(استخدم كلمة مرور قاعدة البيانات التي عرّفتها عند إنشاء المشروع)
`);
  process.exit(1);
}

const migrationFile = path.join(
  root,
  'supabase/migrations/20260328120000_exit_requests_driver_loading_time.sql'
);
const sql = fs.readFileSync(migrationFile, 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('✅ تم تطبيق ترحيل exit_requests (احتساب وقت التحميل) بنجاح.');
} catch (e) {
  console.error('❌ فشل تنفيذ SQL:', e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
