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

if (!connectionString || !connectionString.startsWith("postgres")) {
  console.error("❌ Missing SUPABASE_DB_URL_INSTALLATION or SUPABASE_DB_URL.");
  process.exit(1);
}

const requiredTables = [
  "installation_staff_members",
  "installation_vehicles",
  "installation_vehicle_maintenance",
  "installation_exit_requests",
  "installation_maintenance_requests",
  "installation_driver_issue_reports",
  "installation_attendance",
  "installation_attendance_archive",
  "installation_violations",
  "installation_reports",
  "inventory_item_templates",
  "gate_notifications",
];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();

  for (const table of requiredTables) {
    const { rows } = await client.query(
      `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = $1
      ) as ok
      `,
      [table]
    );
    if (!rows[0]?.ok) {
      throw new Error(`Required table missing: ${table}`);
    }
  }

  const { rows: inventoryRows } = await client.query(
    "select count(*)::int as c from public.inventory_item_templates where department_code = 'installation'"
  );

  console.log("✅ Installation schema validation passed.");
  console.log(`   - required tables: ${requiredTables.length}`);
  console.log(`   - installation inventory templates: ${inventoryRows[0]?.c ?? 0}`);
} catch (error) {
  console.error("❌ Validation failed:", error.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
