"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X, FileVideo, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import type { VideoCategoryRecord } from "@/lib/types";
import { Button } from "@/components/ui";
import { DEPARTMENTS } from "@/lib/constants";
import { formatBytes, cn } from "@/lib/utils";

export function UploadForm({ categories }: { categories: VideoCategoryRecord[] }) {
  const router = useRouter();
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState(categories[0]?.id ?? "");
  const [departmentId, setDepartmentId] = React.useState("dept_logistics");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  function addTag(e: React.KeyboardEvent) {
    if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
      e.preventDefault();
      const t = tagInput.trim().replace(/,$/, "");
      if (t && !tags.includes(t)) setTags([...tags, t]);
      setTagInput("");
    }
  }

  async function submit() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      // في الإنتاج: نطلب رابط رفع موقّع (presigned URL) من /api/videos/upload،
      // نرفع الملف مباشرة إلى MinIO/S3، ثم نُنشئ سجل الفيديو ونُدرج مهمة النسخ.
      const res = await fetch("/api/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categoryId,
          departmentId,
          tags,
          fileName: file?.name ?? null,
          sizeBytes: file?.size ?? 0,
        }),
      });
      const out = await res.json().catch(() => null);
      // عند توفّر رابط رفع موقّع (Supabase Storage) ارفع الملف مباشرةً إليه.
      if (out?.upload?.signedUrl && file) {
        await fetch(out.upload.signedUrl, {
          method: "PUT",
          body: file,
          headers: { "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" },
        });
      }
      setDone(true);
      setTimeout(() => router.push("/videos"), 1400);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card grid place-items-center gap-3 p-12 text-center">
        <CheckCircle2 className="h-14 w-14 text-ok" />
        <h2 className="font-display text-lg font-bold text-ink">تم استلام الفيديو</h2>
        <p className="max-w-md text-sm text-muted">
          جارٍ تجهيز الفيديو. في المرحلة الثانية سيُنسخ الكلام نصياً تلقائياً وتُستخرج الفصول والمواضيع لجعله قابلاً للبحث الدقيق.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Dropzone */}
      <div className="lg:col-span-2">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setFile(f);
          }}
          className={cn(
            "card flex min-h-[260px] flex-col items-center justify-center gap-3 border-2 border-dashed p-8 text-center transition",
            drag ? "border-teal bg-teal-soft/40" : "border-line"
          )}
        >
          {file ? (
            <>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-soft text-teal-ink"><FileVideo className="h-7 w-7" /></div>
              <p className="font-semibold text-ink">{file.name}</p>
              <p className="text-2xs text-muted">{formatBytes(file.size)}</p>
              <button onClick={() => setFile(null)} className="text-2xs font-semibold text-danger hover:underline">إزالة الملف</button>
            </>
          ) : (
            <>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-faint"><UploadCloud className="h-7 w-7" /></div>
              <p className="font-semibold text-ink">اسحب ملف الفيديو هنا</p>
              <p className="text-2xs text-muted">MP4 / MOV / WEBM — حتى 2 جيجابايت</p>
              <label className="mt-1 cursor-pointer rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-line">
                اختر ملفاً
                <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </>
          )}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-2xs text-muted">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-ink" />
          عند الرفع في الإنتاج، يُخزَّن الملف في MinIO ويُدرَج تلقائياً في طابور النسخ النصي (المرحلة الثانية) لاستخراج النص والفصول والمواضيع.
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-3">
        <Field label="عنوان الفيديو *">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="inp" placeholder="مثال: تجهيز الفواتير وإسناد السائقين" />
        </Field>
        <Field label="الوصف">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="inp resize-none" placeholder="وصف موجز لمحتوى الفيديو" />
        </Field>
        <Field label="التصنيف">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="inp">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="القسم">
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="inp">
            {DEPARTMENTS.map((d) => <option key={d.code} value={`dept_${d.code.toLowerCase()}`}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="الوسوم">
          <div className="rounded-xl border border-line bg-surface px-2 py-2">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md bg-teal-soft px-2 py-0.5 text-2xs font-semibold text-teal-ink">
                  {t}
                  <button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={addTag}
                className="min-w-[80px] flex-1 bg-transparent px-1 text-xs text-ink outline-none placeholder:text-faint"
                placeholder="أضف وسماً ثم Enter"
              />
            </div>
          </div>
        </Field>

        <Button className="w-full" size="lg" onClick={submit} disabled={busy || !title.trim()}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <><UploadCloud className="h-5 w-5" /> رفع الفيديو</>}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
