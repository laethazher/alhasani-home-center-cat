"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Users, Upload, Search, UploadCloud, Plus } from "lucide-react";
import { Card, CardHeader, CardBody, Badge, Avatar, Button } from "@/components/ui";
import { ROLE_LABEL, DEPARTMENTS, DOC_TYPE_LABEL, CONFIDENTIALITY_LABEL } from "@/lib/constants";
import type { Role, DocumentType, Confidentiality } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  employeeNo: string;
  role: Role;
  title: string;
  departmentName: string;
  avatarColor: string;
}

const ROLE_TONE: Record<Role, "teal" | "info" | "muted"> = {
  ADMIN: "teal",
  EMPLOYEE: "muted",
  LEARNER: "muted",
};

export function AdminTabs({ users }: { users: AdminUserRow[] }) {
  const params = useSearchParams();
  const [tab, setTab] = React.useState<"users" | "upload">(
    params.get("tab") === "upload" ? "upload" : "users"
  );

  return (
    <>
      <div className="mb-5 inline-flex rounded-xl border border-line bg-surface p-1">
        <TabBtn active={tab === "users"} onClick={() => setTab("users")} icon={<Users className="h-4 w-4" />}>المستخدمون</TabBtn>
        <TabBtn active={tab === "upload"} onClick={() => setTab("upload")} icon={<Upload className="h-4 w-4" />}>رفع وثيقة</TabBtn>
      </div>

      {tab === "users" ? <UsersTab users={users} /> : <UploadTab />}
    </>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition", active ? "bg-teal-soft text-teal-ink" : "text-muted hover:text-ink")}>
      {icon}{children}
    </button>
  );
}

function UsersTab({ users }: { users: AdminUserRow[] }) {
  const [q, setQ] = React.useState("");
  const filtered = users.filter((u) => u.name.includes(q) || u.email.includes(q) || u.employeeNo.includes(q));
  return (
    <Card>
      <CardHeader
        title="إدارة المستخدمين"
        subtitle={`${users.length} مستخدم`}
        action={<Button size="sm"><Plus className="h-4 w-4" /> مستخدم جديد</Button>}
      />
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو البريد أو الرقم الوظيفي…" className="h-10 w-full rounded-xl border border-line bg-surface-2 pe-10 ps-4 text-sm text-ink placeholder:text-faint focus:border-teal" />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-2xs uppercase tracking-wider text-faint">
            <th className="px-4 py-3 text-start font-semibold">الموظف</th>
            <th className="hidden px-4 py-3 text-start font-semibold sm:table-cell">القسم</th>
            <th className="px-4 py-3 text-start font-semibold">الدور</th>
            <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">الرقم الوظيفي</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filtered.map((u) => (
            <tr key={u.id} className="transition hover:bg-surface-2">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} color={u.avatarColor} size={34} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{u.name}</p>
                    <p className="truncate text-2xs text-muted" dir="ltr">{u.email}</p>
                  </div>
                </div>
              </td>
              <td className="hidden px-4 py-3 text-muted sm:table-cell">{u.departmentName}</td>
              <td className="px-4 py-3"><Badge tone={ROLE_TONE[u.role]}>{ROLE_LABEL[u.role]}</Badge></td>
              <td className="hidden px-4 py-3 font-mono text-2xs text-muted md:table-cell" dir="ltr">{u.employeeNo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function UploadTab() {
  const [keywords, setKeywords] = React.useState<string[]>([]);
  const [kw, setKw] = React.useState("");
  const [done, setDone] = React.useState(false);

  function addKw(e: React.KeyboardEvent) {
    if (e.key === "Enter" && kw.trim()) {
      e.preventDefault();
      setKeywords((k) => Array.from(new Set([...k, kw.trim()])));
      setKw("");
    }
  }

  return (
    <Card>
      <CardHeader title="رفع وثيقة جديدة" subtitle="تُفهرس تلقائياً عبر OCR وتُضاف إلى محرك البحث والمساعد المعرفي" />
      <CardBody className="space-y-5">
        {done && (
          <div className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
            تم استلام الوثيقة (عرض تجريبي). في بيئة الإنتاج تُرفع إلى التخزين، ثم تمرّ بسلسلة المعالجة: OCR ← فهرسة Elasticsearch ← تقطيع ← تضمين في Qdrant.
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان الوثيقة"><input className="field" placeholder="مثال: سياسة المشتريات" /></Field>
          <Field label="رقم الوثيقة"><input className="field font-mono" dir="ltr" placeholder="AH-POL-2026-00X" /></Field>
          <Field label="النوع">
            <select className="field">
              {(Object.keys(DOC_TYPE_LABEL) as DocumentType[]).map((t) => <option key={t} value={t}>{DOC_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="القسم">
            <select className="field">{DEPARTMENTS.map((d) => <option key={d.code}>{d.name}</option>)}</select>
          </Field>
          <Field label="مستوى السرية">
            <select className="field">
              {(Object.keys(CONFIDENTIALITY_LABEL) as Confidentiality[]).map((c) => <option key={c} value={c}>{CONFIDENTIALITY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="تاريخ النفاذ"><input type="date" className="field" /></Field>
        </div>

        <Field label="الملخّص">
          <textarea rows={3} className="field resize-none" placeholder="ملخّص تنفيذي موجز للوثيقة…" />
        </Field>

        <Field label="الكلمات المفتاحية">
          <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={addKw} className="field" placeholder="اكتب كلمة ثم اضغط Enter" />
          {keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1 text-2xs text-muted">
                  #{k}
                  <button onClick={() => setKeywords((ks) => ks.filter((x) => x !== k))} className="text-faint hover:text-danger">×</button>
                </span>
              ))}
            </div>
          )}
        </Field>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink">ملف الوثيقة (PDF)</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-surface-2 px-6 py-10 text-center transition hover:border-teal/40">
            <UploadCloud className="h-8 w-8 text-faint" />
            <span className="text-sm font-medium text-ink">اسحب الملف هنا أو اضغط للاختيار</span>
            <span className="text-2xs text-faint">PDF حتى ١٠ ميغابايت — سيُستخرج نصه تلقائياً</span>
            <input type="file" accept="application/pdf" className="hidden" />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="outline">حفظ كمسودة</Button>
          <Button onClick={() => setDone(true)}>رفع ونشر</Button>
        </div>
      </CardBody>

      <style>{`.field{height:2.75rem;width:100%;border-radius:0.75rem;border:1px solid rgb(var(--line));background:rgb(var(--surface-2));padding:0 0.875rem;font-size:0.875rem;color:rgb(var(--ink))}.field:focus{border-color:rgb(var(--teal));outline:none}textarea.field{height:auto;padding:0.75rem 0.875rem}`}</style>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink">{label}</label>
      {children}
    </div>
  );
}
