# خطوات تحتاج تدخّلك أنت فقط (5 دقائق)

## 1) كلمة مرور قاعدة البيانات (مطلوب)

الاتصال يصل لـ Supabase لكن **كلمة المرور الحالية مرفوضة**.

1. افتح [Supabase Dashboard](https://supabase.com/dashboard/project/jxwzaoogmqzcqgnldwpm/settings/database)
2. **Database → Connection string → URI** (Session pooler, منطقة **ap-south-1**)
3. انسخ كلمة المرور الصحيحة وحدّث في `.env.local`:

```
SUPABASE_DB_PASSWORD=كلمة_المرور_الصحيحة
DATABASE_URL=postgresql://postgres%2Ejxwzaoogmqzcqgnldwpm:كلمة_المرور_URL_ENCODED@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres%2Ejxwzaoogmqzcqgnldwpm:كلمة_المرور_URL_ENCODED@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

> استبدل `!` في كلمة المرور بـ `%21` داخل الرابط.

**أو** نفّذ SQL يدوياً (الخطوة 2) من SQL Editor بدون سكربت.

---

## 2) SQL في Supabase (مرّة واحدة)

Supabase → **SQL Editor** → New query → Run بالترتيب:

**أ)** محتوى [`scripts/supabase-km-bootstrap.sql`](scripts/supabase-km-bootstrap.sql)  
**ب)** محتوى [`prisma/migrations/20260627000000_init_km/migration.sql`](prisma/migrations/20260627000000_init_km/migration.sql)

تأكّد: كل الجداول تبدأ بـ `km.` — **لا `public.`**

---

## 3) Service Role Key (لرفع الفيديو والمزامنة)

Supabase → **Project Settings → API → service_role**  
أضف في `.env.local`:

```
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 4) دلو الفيديو

Supabase → **Storage → New bucket**  
- الاسم: `academy-videos`  
- **Private**

---

## 5) بعد ما تكمل — شغّل محلياً

```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2\al-hasani-km-platform"
Copy-Item .env.local .env -Force
npm run db:seed
npm run sync:content
npm run dev
```

---

## ما تم إنجازه تلقائياً ✅

- `npm install` + `prisma generate`
- عزل schema `km` + أدوار ADMIN/EMPLOYEE/LEARNER
- ملف هجرة SQL جاهز (`init_km`)
- إصلاح build (login Suspense + eslint)
