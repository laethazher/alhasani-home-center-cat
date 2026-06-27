/**
 * مزامنة المحتوى من نظام Home Center (Supabase) إلى منصّة المعرفة.
 * يستورد «الكتب/الخطابات الإدارية» من جدول operations_admin_letters (ودلو التخزين
 * operations-admin-letters) إلى نموذج Document في المنصّة.
 *
 * التشغيل:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... DATABASE_URL=... \
 *   npm run sync:content
 *
 * idempotent: يتخطّى الوثائق الموجودة (بحسب documentNumber).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

const prisma = new PrismaClient();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const LETTERS_TABLE = "operations_admin_letters";
const LETTERS_BUCKET = "operations-admin-letters";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("✗ مطلوب NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AdminLetter {
  id: number;
  letter_number: string;
  letter_type: string;
  subject: string;
  content_summary: string | null;
  letter_date: string | null;
  archive_status: string;
  file_path: string | null;
  file_name: string | null;
  file_mime: string | null;
  tags: string[] | null;
}

function mapType(t: string): any {
  switch ((t || "").toLowerCase()) {
    case "circular":
      return "CIRCULAR";
    case "memo":
      return "NOTICE";
    case "decision":
      return "INSTRUCTION";
    default:
      return "ADMIN_BOOK";
  }
}
function mapStatus(s: string): any {
  switch ((s || "").toLowerCase()) {
    case "archived":
      return "ARCHIVED";
    case "expired":
      return "EXPIRED";
    default:
      return "PUBLISHED";
  }
}

async function ensureSystemUser(): Promise<string> {
  // مالك افتراضي للوثائق المستوردة.
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (admin) return admin.id;
  const created = await prisma.user.create({
    data: {
      employeeNo: "SYS",
      name: "النظام",
      email: "system@alhasani.local",
      passwordHash: "",
      role: "ADMIN",
      isActive: true,
    },
  });
  return created.id;
}

async function ensureAdminDept(): Promise<string> {
  const dep =
    (await prisma.department.findFirst({ where: { code: "ADMIN" } })) ??
    (await prisma.department.create({ data: { code: "ADMIN", name: "الإدارة" } }));
  return dep.id;
}

async function main() {
  console.log("→ جلب الخطابات/الكتب من Supabase…");
  const { data, error } = await supabase
    .from(LETTERS_TABLE)
    .select("id, letter_number, letter_type, subject, content_summary, letter_date, archive_status, file_path, file_name, file_mime, tags");
  if (error) {
    console.error("✗ خطأ في القراءة:", error.message);
    process.exit(1);
  }
  const letters = (data ?? []) as AdminLetter[];
  console.log(`  وجدت ${letters.length} سجلاً.`);

  const ownerId = await ensureSystemUser();
  const departmentId = await ensureAdminDept();
  let created = 0;
  let skipped = 0;

  for (const l of letters) {
    const documentNumber = l.letter_number || `LETTER-${l.id}`;
    const existing = await prisma.document.findUnique({ where: { documentNumber } });
    if (existing) {
      skipped++;
      continue;
    }

    // رابط الملف: نولّد رابطاً موقّعاً طويل الأمد إن وُجد مسار في التخزين.
    let fileUrl = "#";
    if (l.file_path) {
      const { data: signed } = await supabase.storage
        .from(LETTERS_BUCKET)
        .createSignedUrl(l.file_path, 60 * 60 * 24 * 365);
      fileUrl = signed?.signedUrl ?? l.file_path;
    }

    const doc = await prisma.document.create({
      data: {
        documentNumber,
        title: l.subject || documentNumber,
        type: mapType(l.letter_type),
        status: mapStatus(l.archive_status),
        confidentiality: "INTERNAL",
        summary: l.content_summary,
        keywords: l.tags ?? [],
        ownerId,
        departmentId,
        effectiveDate: l.letter_date ? new Date(l.letter_date) : null,
        publishedAt: l.letter_date ? new Date(l.letter_date) : new Date(),
        versions: {
          create: {
            versionNumber: 1,
            fileUrl,
            fileName: l.file_name ?? `${documentNumber}.pdf`,
            mimeType: l.file_mime ?? "application/pdf",
            uploadedById: ownerId,
          },
        },
      },
      include: { versions: true },
    });
    await prisma.document.update({
      where: { id: doc.id },
      data: { currentVersionId: doc.versions[0].id },
    });
    created++;
  }

  console.log(`✅ اكتملت المزامنة — أُنشئت ${created} وثيقة، تُخطّيت ${skipped}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
