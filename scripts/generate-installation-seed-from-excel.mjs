import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const inputDir = path.join(root, "data", "import");
const outputFile = path.join(root, "supabase-installation", "seed.generated.sql");

const staffFile = path.join(inputDir, "اسماء الكادر الفني.xlsx");
const vehiclesFile = path.join(inputDir, "مركبات كادر التركيب.xlsx");
const toolsFile = path.join(inputDir, "معدات كادر التركيب.xlsx");

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[ـ_-]/g, "");
}

function escapeSql(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function readSheetRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

const staffRows = readSheetRows(staffFile);
const vehicleRows = readSheetRows(vehiclesFile);
const toolRows = readSheetRows(toolsFile);

const staffValues = staffRows
  .map((row) => {
    const entries = Object.entries(row);
    const name = entries.find(([k]) => normalizeHeader(k).includes("اسم"))?.[1];
    const city = entries.find(([k]) => normalizeHeader(k).includes("موقع") || normalizeHeader(k).includes("محافظ"))?.[1];
    if (!name) return null;
    return `('${escapeSql(name)}', 'technician', ${city ? `'${escapeSql(city)}'` : "null"}, true)`;
  })
  .filter(Boolean);

const vehicleValues = vehicleRows
  .map((row) => {
    const entries = Object.entries(row);
    const number = entries.find(([k]) => normalizeHeader(k).includes("رقم"))?.[1];
    const typeRaw = entries.find(([k]) => normalizeHeader(k).includes("نوع"))?.[1];
    const location = entries.find(([k]) => normalizeHeader(k).includes("موقع"))?.[1];
    const staffName = entries.find(([k]) => normalizeHeader(k).includes("اسم"))?.[1];
    if (!number || !typeRaw) return null;
    const type = String(typeRaw).includes("نيسان") ? "nissan" : "starex";
    const responsible = staffName ? `'${escapeSql(staffName)}'` : "null";
    return `('${escapeSql(number)}', '${type}', ${location ? `'${escapeSql(location)}'` : "null"}, ${responsible}, 'available')`;
  })
  .filter(Boolean);

const toolValues = toolRows
  .map((row, index) => {
    const entries = Object.entries(row);
    const item = entries.find(([k]) => normalizeHeader(k).includes("عدة") || normalizeHeader(k).includes("معدة") || normalizeHeader(k).includes("اسم"))?.[1];
    const qty = Number(entries.find(([k]) => normalizeHeader(k).includes("عدد") || normalizeHeader(k).includes("qty"))?.[1] || 1);
    if (!item) return null;
    return `('installation', 'tools', '${escapeSql(item)}', ${Number.isFinite(qty) ? qty : 1}, ${(index + 1) * 10}, true)`;
  })
  .filter(Boolean);

const sql = `-- Generated from Excel files in data/import
-- Generated at: ${new Date().toISOString()}

${staffValues.length > 0 ? `insert into public.installation_staff_members (full_name, role, city, is_active)
values
  ${staffValues.join(",\n  ")}
on conflict (full_name) do update
set role = excluded.role,
    city = excluded.city,
    is_active = excluded.is_active;` : "-- No staff rows found."}

${vehicleValues.length > 0 ? `insert into public.installation_vehicles (vehicle_number, vehicle_type, location, responsible_staff_id, status)
select
  v.vehicle_number,
  v.vehicle_type,
  v.location,
  s.id,
  v.status
from (
  values
    ${vehicleValues.join(",\n    ")}
) as v(vehicle_number, vehicle_type, location, staff_name, status)
left join public.installation_staff_members s on s.full_name = v.staff_name
on conflict (vehicle_number) do update
set vehicle_type = excluded.vehicle_type,
    location = excluded.location,
    responsible_staff_id = excluded.responsible_staff_id,
    status = excluded.status,
    updated_at = now();` : "-- No vehicle rows found."}

${toolValues.length > 0 ? `insert into public.inventory_item_templates (department_code, category, item_name, required_quantity, sort_order, is_active)
values
  ${toolValues.join(",\n  ")}
on conflict (department_code, category, item_name) do update
set required_quantity = excluded.required_quantity,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active,
    updated_at = now();` : "-- No tool rows found."}
`;

fs.writeFileSync(outputFile, sql, "utf8");
console.log(`✅ Generated: ${path.relative(root, outputFile)}`);
console.log(`   staff rows: ${staffValues.length}`);
console.log(`   vehicle rows: ${vehicleValues.length}`);
console.log(`   tool rows: ${toolValues.length}`);
