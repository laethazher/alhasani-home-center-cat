import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_DEPARTMENTS, DEMO_USERS } from "../src/lib/data/users";
import { SAMPLE_DOCUMENTS, SAMPLE_SOPS } from "../src/lib/data/sampleData";
import { seedPhase1 } from "./seed.phase1";

// تحميل .env.local ثم .env (Prisma CLI يحمّل .env فقط)
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
// للبذور: بناء DATABASE_URL من SUPABASE_DB_* فقط إذا لم يُعرَّف DATABASE_URL
if (
  !process.env.DATABASE_URL &&
  process.env.SUPABASE_DB_HOST &&
  process.env.SUPABASE_DB_USER &&
  process.env.SUPABASE_DB_PASSWORD
) {
  const pw = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD);
  process.env.DATABASE_URL = `postgresql://${process.env.SUPABASE_DB_USER}:${pw}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT || 5432}/postgres`;
}

const prisma = new PrismaClient();

async function main() {
  console.log("⏳ Seeding…");

  // Departments
  for (const d of DEMO_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name },
      create: { id: d.id, code: d.code, name: d.name },
    });
  }

  // Users (hash demo passwords)
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const dept = DEMO_DEPARTMENTS.find((d) => d.code === u.departmentCode);
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, title: u.title, passwordHash, departmentId: dept?.id },
      create: {
        id: u.id,
        employeeNo: u.employeeNo,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        title: u.title,
        avatarColor: u.avatarColor,
        departmentId: dept?.id,
      },
    });
  }

  // Wire department managers
  for (const d of DEMO_DEPARTMENTS) {
    const mgr = DEMO_USERS.find((u) => u.employeeNo === d.managerEmpNo);
    if (mgr) await prisma.department.update({ where: { code: d.code }, data: { managerId: mgr.id } });
  }

  // Documents (+ a single current version each)
  for (const doc of SAMPLE_DOCUMENTS) {
    const owner = DEMO_USERS.find((u) => u.name === doc.ownerName) ?? DEMO_USERS[0];
    const created = await prisma.document.upsert({
      where: { documentNumber: doc.documentNumber },
      update: { title: doc.title, status: doc.status, summary: doc.summary ?? undefined },
      create: {
        id: doc.id,
        documentNumber: doc.documentNumber,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        confidentiality: doc.confidentiality,
        summary: doc.summary ?? undefined,
        keywords: doc.keywords,
        ownerId: owner.id,
        departmentId: doc.departmentId,
        effectiveDate: doc.effectiveDate ? new Date(doc.effectiveDate) : undefined,
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate) : undefined,
        publishedAt: doc.publishedAt ? new Date(doc.publishedAt) : undefined,
      },
    });

    const version = await prisma.documentVersion.upsert({
      where: { documentId_versionNumber: { documentId: created.id, versionNumber: doc.versions?.[0]?.versionNumber ?? 1 } },
      update: {},
      create: {
        documentId: created.id,
        versionNumber: doc.versions?.[0]?.versionNumber ?? 1,
        fileUrl: doc.versions?.[0]?.fileUrl ?? "#",
        fileName: doc.versions?.[0]?.fileName ?? `${doc.documentNumber}.pdf`,
        fileSize: doc.versions?.[0]?.fileSize ?? 100000,
        pageCount: doc.pageCount,
        uploadedById: owner.id,
        ocrDone: true,
        ocrText: doc.summary ?? doc.title,
      },
    });
    await prisma.document.update({ where: { id: created.id }, data: { currentVersionId: version.id } });
  }

  // SOPs (+ steps + mistakes)
  for (const sop of SAMPLE_SOPS) {
    const owner = DEMO_USERS.find((u) => u.name === sop.ownerName) ?? DEMO_USERS[0];
    const linkedDoc = sop.documentNumber
      ? await prisma.document.findUnique({ where: { documentNumber: sop.documentNumber } })
      : null;
    const created = await prisma.sop.upsert({
      where: { code: sop.code },
      update: { title: sop.title, status: sop.status },
      create: {
        id: sop.id,
        code: sop.code,
        title: sop.title,
        summary: sop.summary ?? undefined,
        status: sop.status,
        departmentId: sop.departmentId,
        ownerId: owner.id,
        estimatedMinutes: sop.estimatedMinutes ?? undefined,
        documentId: linkedDoc?.id,
      },
    });
    await prisma.sopStep.deleteMany({ where: { sopId: created.id } });
    for (const s of sop.steps) {
      await prisma.sopStep.create({
        data: {
          sopId: created.id,
          order: s.order,
          title: s.title,
          description: s.description,
          imageUrl: s.imageUrl ?? undefined,
          videoUrl: s.videoUrl ?? undefined,
          warning: s.warning ?? undefined,
          severity: s.severity,
        },
      });
    }
    await prisma.sopMistake.deleteMany({ where: { sopId: created.id } });
    for (const m of sop.commonMistakes) {
      await prisma.sopMistake.create({
        data: { sopId: created.id, description: m.description, consequence: m.consequence ?? undefined, severity: m.severity },
      });
    }
  }

  // A sample quiz tied to the security policy
  const policy = await prisma.document.findUnique({ where: { documentNumber: "AH-POL-2026-001" } });
  if (policy) {
    const exists = await prisma.quiz.findFirst({ where: { documentId: policy.id } });
    if (!exists) {
      const quiz = await prisma.quiz.create({
        data: { title: "اختبار الامتثال: سياسة أمن المعلومات", documentId: policy.id, passingScore: 70 },
      });
      const q = await prisma.quizQuestion.create({
        data: { quizId: quiz.id, text: "ما الإجراء المطلوب على الحسابات وفق التعميم؟", type: "SINGLE", order: 1 },
      });
      await prisma.quizOption.createMany({
        data: [
          { questionId: q.id, text: "تفعيل المصادقة الثنائية", isCorrect: true },
          { questionId: q.id, text: "مشاركة كلمة المرور", isCorrect: false },
          { questionId: q.id, text: "تعطيل قفل الشاشة", isCorrect: false },
        ],
      });
    }
  }

  // Phase 1 — Academy & Video Library
  await seedPhase1(prisma);

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
