import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import xlsx from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function getArg(name) {
  const idx = process.argv.findIndex((a) => a === name);
  return idx >= 0 ? process.argv[idx + 1] : "";
}

const inputDir = path.join(root, "data", "import");
const outputArg = getArg("--out");
const outputFile = outputArg
  ? path.resolve(root, outputArg)
  : path.join(root, "supabase-installation", "seed.generated.sql");

const staffArg = getArg("--staff-file");
const vehiclesArg = getArg("--vehicles-file");
const toolsArg = getArg("--tools-file");

const staffFile = staffArg ? path.resolve(root, staffArg) : path.join(inputDir, "اسماء الكادر الفني.xlsx");
const vehiclesFile = vehiclesArg ? path.resolve(root, vehiclesArg) : path.join(inputDir, "مركبات كادر التركيب.xlsx");
const toolsFile = toolsArg ? path.resolve(root, toolsArg) : path.join(inputDir, "معدات كادر التركيب.xlsx");

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
  const keywordScore = (header) => {
    const h = normalizeHeader(header);
    if (!h) return 0;
    let score = 1;
    if (h.includes("اسم")) score += 4;
    if (h.includes("رقم")) score += 4;
    if (h.includes("نوع")) score += 4;
    if (h.includes("موقع") || h.includes("محافظ")) score += 3;
    if (h.includes("عدة") || h.includes("معدة")) score += 3;
    return score;
  };

  const parseAoa = (sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return { score: -1, rows: [] };
    const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (!Array.isArray(aoa) || aoa.length < 2) return { score: -1, rows: [] };
    const headerRowIndex = aoa.findIndex((row) => {
      const cells = (row || []).map((v) => String(v ?? "").trim()).filter(Boolean);
      return cells.length >= 2;
    });
    if (headerRowIndex < 0 || headerRowIndex >= aoa.length - 1) {
      return { score: -1, rows: [] };
    }
    const headers = (aoa[headerRowIndex] || []).map((v) => String(v ?? "").trim());
    const headerScore = headers.reduce((sum, h) => sum + keywordScore(h), 0);
    const nonEmptyHeaders = headers.filter((h) => h.length > 0).length;
    if (nonEmptyHeaders === 0) return { score: -1, rows: [] };

    const rows = aoa
      .slice(headerRowIndex + 1)
      .map((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          if (!header) return;
          obj[header] = row[idx] ?? "";
        });
        return obj;
      })
      .filter((obj) =>
        Object.values(obj).some((v) => String(v ?? "").trim() !== "")
      );

    return { score: headerScore + nonEmptyHeaders, rows };
  };

  let best = { score: -1, rows: [] };
  for (const sheetName of workbook.SheetNames) {
    const parsed = parseAoa(sheetName);
    if (parsed.score > best.score) best = parsed;
  }

  return best.rows;
}

function readStaffRows(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const workbook = xlsx.readFile(filePath);
  let bestRows = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const aoa = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    const rows = [];

    for (const row of aoa) {
      const serial = String(row?.[0] ?? "").trim();
      const nameCell = String(row?.[1] ?? "").trim();
      if (!nameCell) continue;
      if (!/^\d+$/.test(serial)) continue;

      const parts = nameCell.split("/").map((p) => p.trim()).filter(Boolean);
      const full_name = parts[0] || "";
      const city = parts[1] || null;
      if (!full_name) continue;

      rows.push({
        "اسم الفني": full_name,
        "الموقع": city,
      });
    }

    if (rows.length > bestRows.length) bestRows = rows;
  }

  return bestRows;
}

const staffRows = readStaffRows(staffFile);
const vehicleRows = readSheetRows(vehiclesFile);
const toolRows = readSheetRows(toolsFile);

const staffValuesFromStaffSheet = staffRows
  .map((row) => {
    const entries = Object.entries(row);
    const name = entries.find(([k]) => normalizeHeader(k).includes("اسم"))?.[1];
    const city = entries.find(([k]) => normalizeHeader(k).includes("موقع") || normalizeHeader(k).includes("محافظ"))?.[1];
    if (!name) return null;
    return `('${escapeSql(name)}', 'technician', ${city ? `'${escapeSql(city)}'` : "null"}, true)`;
  })
  .filter(Boolean);

const extractedVehicleStaff = vehicleRows
  .map((row) => {
    const entries = Object.entries(row);
    const staffName = entries.find(([k]) => normalizeHeader(k).includes("اسم"))?.[1];
    const location = entries.find(([k]) => normalizeHeader(k).includes("موقع") || normalizeHeader(k).includes("محافظ"))?.[1];
    if (!staffName || !String(staffName).trim()) return null;
    return {
      full_name: String(staffName).trim(),
      city: location ? String(location).trim() : null,
    };
  })
  .filter(Boolean);

const staffMap = new Map();
for (const row of extractedVehicleStaff) {
  if (!row) continue;
  const key = row.full_name;
  if (!staffMap.has(key)) staffMap.set(key, row.city);
}

const inferredStaffValues = Array.from(staffMap.entries()).map(([name, city]) =>
  `('${escapeSql(name)}', 'technician', ${city ? `'${escapeSql(city)}'` : "null"}, true)`
);

const useStaffFileAsSource = Boolean(staffArg && staffRows.length > 0);
const staffValues = useStaffFileAsSource
  ? Array.from(new Set(staffValuesFromStaffSheet))
  : Array.from(new Set([...staffValuesFromStaffSheet, ...inferredStaffValues]));

const staffNamesForSync = (useStaffFileAsSource ? staffRows : extractedVehicleStaff)
  .map((row) => {
    const entries = Object.entries(row || {});
    const name = entries.find(([k]) => normalizeHeader(k).includes("اسم"))?.[1];
    return String(name || "").trim();
  })
  .filter(Boolean);

const uniqueStaffNamesForSync = Array.from(new Set(staffNamesForSync));
const staffDeactivateSql =
  uniqueStaffNamesForSync.length > 0
    ? `

update public.installation_staff_members
set is_active = false
where full_name not in (
  ${uniqueStaffNamesForSync.map((n) => `'${escapeSql(n)}'`).join(",\n  ")}
);`
    : "";

const vehicleMap = new Map();
for (const row of vehicleRows) {
  const entries = Object.entries(row);
  const number = entries.find(([k]) => normalizeHeader(k).includes("رقم"))?.[1];
  const typeRaw = entries.find(([k]) => normalizeHeader(k).includes("نوع"))?.[1];
  const location = entries.find(([k]) => normalizeHeader(k).includes("موقع"))?.[1];
  const staffName = entries.find(([k]) => normalizeHeader(k).includes("اسم"))?.[1];
  if (!number || !typeRaw) continue;
  const key = String(number).trim();
  if (!key) continue;
  const type = String(typeRaw).includes("نيسان") ? "nissan" : "starex";
  vehicleMap.set(key, {
    key,
    type,
    location: location ? String(location).trim() : "",
    staffName: staffName ? String(staffName).trim() : "",
  });
}

const vehicleValues = Array.from(vehicleMap.values()).map((v) => {
  const responsible = v.staffName ? `'${escapeSql(v.staffName)}'` : "null";
  return `('${escapeSql(v.key)}', '${v.type}', ${v.location ? `'${escapeSql(v.location)}'` : "null"}, ${responsible}, 'available')`;
});

const toolMap = new Map();
for (const row of toolRows) {
  const entries = Object.entries(row);
  const item = entries.find(([k]) => normalizeHeader(k).includes("عدة") || normalizeHeader(k).includes("معدة") || normalizeHeader(k).includes("اسم"))?.[1];
  const qty = Number(entries.find(([k]) => normalizeHeader(k).includes("عدد") || normalizeHeader(k).includes("qty"))?.[1] || 1);
  if (!item) continue;
  const key = String(item).trim();
  if (!key) continue;
  if (!toolMap.has(key)) {
    toolMap.set(key, { key, qty: Number.isFinite(qty) ? qty : 1 });
  }
}

const toolValues = Array.from(toolMap.values()).map((tool, index) => (
  `('installation', 'tools', '${escapeSql(tool.key)}', ${tool.qty}, ${(index + 1) * 10}, true)`
));

const sql = `-- Generated from Excel files in data/import
-- Generated at: ${new Date().toISOString()}

${staffValues.length > 0 ? `insert into public.installation_staff_members (full_name, role, city, is_active)
values
  ${staffValues.join(",\n  ")}
on conflict (full_name) do update
set role = excluded.role,
    city = excluded.city,
    is_active = excluded.is_active;${staffDeactivateSql}` : "-- No staff rows found."}

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
console.log(`   staff file: ${fs.existsSync(staffFile) ? staffFile : "not found"}`);
console.log(`   vehicles file: ${fs.existsSync(vehiclesFile) ? vehiclesFile : "not found"}`);
console.log(`   tools file: ${fs.existsSync(toolsFile) ? toolsFile : "not found"}`);
console.log(`   staff rows: ${staffValues.length}`);
console.log(`   vehicle rows: ${vehicleValues.length}`);
console.log(`   tool rows: ${toolValues.length}`);
