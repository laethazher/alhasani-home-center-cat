import dotenv from "dotenv";
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

if (!connectionString) {
  console.error("Missing DB connection string.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  const [staff, vehicles, tools] = await Promise.all([
    client.query("select count(*)::int as c from public.installation_staff_members"),
    client.query("select count(*)::int as c from public.installation_vehicles"),
    client.query("select count(*)::int as c from public.inventory_item_templates where department_code = 'installation'"),
  ]);
  console.log("✅ Installation counts:");
  console.log(`   staff: ${staff.rows[0]?.c ?? 0}`);
  console.log(`   vehicles: ${vehicles.rows[0]?.c ?? 0}`);
  console.log(`   tools: ${tools.rows[0]?.c ?? 0}`);
} catch (error) {
  console.error("❌ Failed:", error.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
