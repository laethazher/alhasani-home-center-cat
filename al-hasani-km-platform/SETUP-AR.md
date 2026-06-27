# تشغيل منصّة الحسني هوم سنتر (km)

## المتطلبات
- Node.js 20+
- نسخة احتياطية من Supabase قبل أي SQL
- `SUPABASE_SERVICE_ROLE_KEY` في `.env.local` (لرفع الفيديو والمزامنة)

## 1) التثبيت
```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2\al-hasani-km-platform"
npm install
npm run prisma:generate
```

## 2) Bootstrap قاعدة البيانات (schema km + trigger المتعلّمين)
```powershell
npm run db:bootstrap
```

## 3) هجرة Prisma (km فقط — راجع SQL قبل التطبيق)
```powershell
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
npx prisma migrate dev --name init_km
# أو للإنتاج:
npx prisma migrate deploy
npm run db:seed
```

## 4) Supabase Storage
أنشئ دلو **`academy-videos`** (private) من Dashboard.

## 5) مزامنة المحتوى (بعد إضافة service_role)
```powershell
npm run sync:content
npm run search:index
```

## 6) التشغيل
```powershell
npm run dev
# http://localhost:3000
```

## 7) Render
- Build: `npm install && npm run prisma:generate && npm run build`
- Start: `npm start`
- أضف متغيّرات `.env.local` في Render Environment

## الأدوار
| نظام المركبات (user_profiles) | منصّة km |
|-------------------------------|----------|
| admin | ADMIN — مدير نظام المنصّة |
| باقي الأدوار | EMPLOYEE — موظف |
| km_role=learner (تسجيل ذاتي) | LEARNER |

## Rollback
```sql
DROP SCHEMA km CASCADE;
```
