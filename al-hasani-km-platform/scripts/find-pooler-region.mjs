/** يكتشف منطقة pooler الصحيحة ويختبر الاتصال — يقرأ .env.local فقط */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  let v = t.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[t.slice(0, i).trim()] = v;
}

const ref = "jxwzaoogmqzcqgnldwpm";
const pass = env.SUPABASE_DB_PASSWORD || "";

const pgPath = path.join(root, "..", "node_modules", "pg");
const { default: pg } = await import(pathToFileURL(path.join(pgPath, "lib", "index.js")).href);

const prefixes = ["aws-0", "aws-1"];
const regions = [
  "eu-central-1",
  "us-east-1",
  "ap-southeast-1",
  "eu-west-1",
  "ap-northeast-1",
  "us-west-1",
  "sa-east-1",
  "ap-south-1",
  "me-central-1",
];

for (const prefix of prefixes) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    for (const user of [`postgres.${ref}`, "postgres"]) {
      const cs = `postgresql://${user}:${encodeURIComponent(pass)}@${host}:5432/postgres`;
      const client = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
      try {
        await client.connect();
        await client.query("SELECT 1");
        console.log(JSON.stringify({ ok: true, prefix, region, user, host }));
        await client.end();
        process.exit(0);
      } catch (e) {
        await client.end().catch(() => {});
        console.log(JSON.stringify({ prefix, region, user, err: e.message }));
      }
    }
  }
}
console.log(JSON.stringify({ ok: false }));
process.exit(1);
