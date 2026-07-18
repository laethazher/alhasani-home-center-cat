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

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

function nowTag() {
  return Date.now().toString().slice(-6);
}

try {
  await client.connect();
  await client.query("BEGIN");

  const tag = nowTag();

  const staffName = `فني_اختبار_${tag}`;
  const vehicleNumber = `T-${tag}`;

  const staffRes = await client.query(
    `
    insert into public.installation_staff_members (full_name, role, city, is_active)
    values ($1, 'technician', 'بغداد', true)
    returning id
    `,
    [staffName]
  );
  const staffId = staffRes.rows[0].id;

  const vehicleRes = await client.query(
    `
    insert into public.installation_vehicles (
      vehicle_number, vehicle_type, model, location, responsible_staff_id, status
    )
    values ($1, 'starex', 'Starex Test', 'بغداد', $2, 'available')
    returning id
    `,
    [vehicleNumber, staffId]
  );
  const vehicleId = vehicleRes.rows[0].id;

  await client.query(
    `
    insert into public.installation_exit_requests (
      vehicle_id, vehicle_number, vehicle_type, location_snapshot, technician_ids, technician_names, responsible_staff_id, status
    )
    values ($1, $2, 'starex', 'بغداد', $3::bigint[], $4::text[], $5, 'pending')
    `,
    [vehicleId, vehicleNumber, [staffId], [staffName], staffId]
  );

  await client.query(
    `
    insert into public.inventory_item_templates (
      department_code, category, item_name, required_quantity, sort_order, is_active
    )
    values ('installation', 'tools', $1, 2, 999, true)
    on conflict (department_code, category, item_name)
    do update set required_quantity = excluded.required_quantity
    `,
    [`عنصر_اختبار_${tag}`]
  );

  const joinRes = await client.query(
    `
    select v.id, v.vehicle_number, s.full_name
    from public.installation_vehicles v
    left join public.installation_staff_members s
      on s.id = v.responsible_staff_id
    where v.id = $1
    `,
    [vehicleId]
  );

  if (!joinRes.rows[0] || joinRes.rows[0].full_name !== staffName) {
    throw new Error("Vehicle/staff relation validation failed.");
  }

  await client.query("ROLLBACK");
  console.log("✅ Installation smoke test passed.");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("❌ Installation smoke test failed:", error.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
