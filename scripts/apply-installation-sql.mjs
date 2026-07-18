import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

for (const name of [".env", ".env.local", ".env.development.local"]) {
  dotenv.config({ path: path.join(root, name) });
}

const connectionString =
  process.env.SUPABASE_DB_URL_INSTALLATION ||
  process.env.DATABASE_URL_INSTALLATION ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL;

if (!connectionString || !connectionString.startsWith("postgres")) {
  console.error(`
❌ Missing database connection string.

Add to .env:
SUPABASE_DB_URL_INSTALLATION="postgresql://postgres.[REF]:[PASSWORD]@...pooler.supabase.com:6543/postgres"

Or (same-project mode):
SUPABASE_DB_URL="postgresql://postgres.[REF]:[PASSWORD]@...pooler.supabase.com:6543/postgres"
`);
  process.exit(1);
}

const fileArgIndex = process.argv.findIndex((arg) => arg === "--file");
const inputFile = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : "";
if (!inputFile) {
  console.error("❌ Usage: node scripts/apply-installation-sql.mjs --file <relative-sql-path>");
  process.exit(1);
}

const sqlFile = path.resolve(root, inputFile);
if (!fs.existsSync(sqlFile)) {
  console.error(`❌ SQL file not found: ${sqlFile}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, "utf8");

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`✅ Applied SQL file successfully: ${inputFile}`);
} catch (error) {
  console.error("❌ Failed to apply SQL:", error.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
