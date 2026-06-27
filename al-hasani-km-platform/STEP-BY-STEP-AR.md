# الخطوات المتبقية — واحدة واحدة

> **أنت نفّذت:** bootstrap SQL + migration SQL ✅  
> **الباقي:** 5 خطوات فقط

---

## الخطوة 1 — كلمة مرور قاعدة البيانات + Connection string

من Supabase Dashboard (كما أرسلته):

```
host:     aws-1-ap-south-1.pooler.supabase.com
port:     5432
database: postgres
user:     postgres.jxwzaoogmqzcqgnldwpm
```

**الرابط الأصلي:**
```
postgresql://postgres.jxwzaoogmqzcqgnldwpm:[YOUR-PASSWORD]@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

1. إذا لا تعرف كلمة المرور: [Reset database password](https://supabase.com/dashboard/project/jxwzaoogmqzcqgnldwpm/settings/database)  
2. افتح `.env.local` وحدّث:

```
SUPABASE_DB_PASSWORD=كلمة_المرور_الجديدة_بدون_ترميز

# Prisma يحتاج ترميز النقطة في اسم المستخدم (%2E) و ! في كلمة المرور (%21)
DATABASE_URL=postgresql://postgres%2Ejxwzaoogmqzcqgnldwpm:كلمة_مرور_مرمّزة%21@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres%2Ejxwzaoogmqzcqgnldwpm:كلمة_مرور_مرمّزة%21@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

3. اختبر الاتصال:

```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2\al-hasani-km-platform"
Copy-Item .env.local .env -Force
npm run db:test
```

**ماذا تتوقع؟** `✓ اتصال ناجح` — إذا فشل، كلمة المرور في `.env.local` لا تطابق Supabase.

---

## الخطوة 2 — مفتاح Service Role (للمزامنة ورفع الفيديو)

1. افتح: https://supabase.com/dashboard/project/jxwzaoogmqzcqgnldwpm/settings/api  
2. انزل لـ **Project API keys**  
3. عند **service_role** اضغط **Reveal** ثم **Copy**  
4. في `.env.local` أزل `#` وأضف:

```
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...الصق_هنا
```

5. احفظ.

> **تحذير:** لا تشارك هذا المفتاح ولا ترفعه GitHub.

---

## الخطوة 3 — دلو الفيديو

**الطريقة أ:** Dashboard → Storage → New bucket → `academy-videos` (Private)

**الطريقة ب:** شغّل في SQL Editor: `scripts/RUN_IN_SQL_EDITOR_storage.sql`

---

## الخطوة 4 — تعبئة البيانات الأولية (Seed)

**الطريقة أ (مفضّلة)** — PowerShell:

```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2\al-hasani-km-platform"
Copy-Item .env.local .env -Force
npx prisma migrate resolve --applied 20260627000000_init_km
npx prisma db seed
```

**الطريقة ب (بديل)** — إذا فشلت كلمة مرور CLI، شغّل في **SQL Editor**:

`scripts/RUN_IN_SQL_EDITOR_seed.sql`

> هذا يضيف أقساماً وتصنيفات وبيانات أساسية. البيانات الكاملة (مستندات، SOPs، دورات) تحتاج CLI بعد إصلاح كلمة المرور.

**ماذا تتوقع؟**
- `migrate resolve` → `Marked migration as applied`  
- `db seed` → `✅ Seed complete` أو رسالة نجاح

**إذا ظهر خطأ كلمة مرور:** راجع الخطوة 1.  
**إذا ظهر Can't reach database:** تأكد إنترنتك أو جرّب VPN.

---

## الخطوة 5 — مزامنة الكتب من نظام المركبات (اختياري)

بعد إضافة `SUPABASE_SERVICE_ROLE_KEY` في الخطوة 2:

```powershell
npm run sync:content
```

**ماذا تتوقع؟** رسائل مثل `imported` أو `skipped` — الكتب من `operations_admin_letters` تنتقل لمنصّة km.

> `npm run search:index` — **تخطّها الآن** (تحتاج Qdrant لاحقاً).

---

## الخطوة 6 — تشغيل المنصّة

```powershell
npm run dev
```

1. افتح المتصفح: **http://localhost:3000**  
2. جرّب:
   - **/** → بوابة المنصّة  
   - **/academy** → الأكاديمية  
   - **/login** → دخول بحساب Supabase (موظف admin)

---

## ملخص سريع

| # | ماذا | أين |
|---|------|-----|
| 1 | كلمة مرور DB | `.env.local` |
| 2 | service_role key | `.env.local` |
| 3 | دلو academy-videos | Supabase Storage |
| 4 | seed | PowerShell |
| 5 | sync كتب | PowerShell (بعد 2) |
| 6 | تشغيل | `npm run dev` |

---

## إذا واجهت مشكلة

انسخ **نص الخطأ كاملاً** وأرسله — أكمل وياك.
