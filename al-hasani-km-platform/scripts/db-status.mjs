import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env.local", ".env"]) {
  const p = path.join(root, name);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const p = new PrismaClient();
const r = {
  departments: await p.department.count(),
  users: await p.user.count(),
  documents: await p.document.count(),
  courses: await p.course.count(),
  videos: await p.video.count(),
  sops: await p.sop.count(),
};
console.log(JSON.stringify(r, null, 2));
await p.$disconnect();
