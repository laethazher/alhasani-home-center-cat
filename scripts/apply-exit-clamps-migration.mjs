/**
 * يطبّق ترحيل CBM + القواطع + الحالات الجديدة على exit_requests.
 * يحتاج SUPABASE_DB_URL أو DATABASE_URL أو DIRECT_URL (سلسلة Postgres من لوحة Supabase).
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

for (const name of ['.env', '.env.local', '.env.development.local']) {
  dotenv.config({ path: path.join(root, name) });
}

const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL;

if (!connectionString || !connectionString.startsWith('postgres')) {
  console.error(`
❌ لم يُعثر على سلسلة اتصال Postgres.

1) أضف في .env أو .env.local في جذر المشروع:

   SUPABASE_DB_URL="postgresql://postgres.[REF]:[PASSWORD]@...pooler.supabase.com:6543/postgres"

   من: Supabase → Project Settings → Database → Connection string → URI

2) أو نفّذ يدوياً الملف: supabase/RUN_IN_SQL_EDITOR_exit_clamps.sql
   في Dashboard → SQL Editor → Run
`);
  process.exit(1);
}

const migrationFile = path.join(
  root,
  'supabase/migrations/20260329120000_exit_requests_clamps_cbm.sql'
);
const sql = fs.readFileSync(migrationFile, 'utf8');

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log('✅ تم تطبيق ترحيل exit_requests (CBM + القواطع + الحالات) بنجاح.');
} catch (e) {
  console.error('❌ فشل تنفيذ SQL:', e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
