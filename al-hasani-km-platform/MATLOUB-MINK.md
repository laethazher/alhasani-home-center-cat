# ✅ الإعداد مكتمل — منصة الحسني هوم سنتر

## تشغيل التطوير (منفذ واحد)

```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2"
npm run dev:unified
```

| الرابط | المحتوى |
|--------|---------|
| http://localhost:3000/ | البوابة |
| http://localhost:3000/academy | الأكاديمية |
| http://localhost:3000/system | نظام المركبات |
| http://localhost:3000/login | دخول المنصّة |

> **مهم:** لا تشغّل `npm run dev` في المجلدين منفصلين — استخدم `dev:unified` فقط.

---

## ما تم إنجازه

| البند | الحالة |
|--------|--------|
| Supabase + schema `km` | ✅ |
| Migration + Seed + Sync (3 وثائق) | ✅ |
| Service Role + Storage bucket | ✅ |
| Auth + RBAC | ✅ |
| تطوير موحّد (منفذ 3000) | ✅ |
| Build + typecheck | ✅ |

---

## Render (الإنتاج)

**خدمتان منفصلتان:**

1. **نظام المركبات:** `alhasani-home-center-cat.onrender.com` — `render.yaml` في جذر HOME 2
2. **المنصّة:** `alhasani-km-platform/render.yaml` — انسخ `.env.local` إلى Environment Variables

في Render للمنصّة، اضبط:
```
NEXT_PUBLIC_SYSTEM_URL=https://alhasani-home-center-cat.onrender.com
```

---

## `.env.local` — ملاحظات

- `NEXT_PUBLIC_SYSTEM_URL=` **فارغ** → `/system` في التطوير الموحّد
- على Render → ضع رابط نظام المركبات الكامل

---

## أوامر مفيدة

```powershell
npm run db:test          # فحص DB
npm run sync:content     # مزامنة الكتب
npm run build            # بناء الإنتاج
```

دليل التطوير الموحّد: `DEV-UNIFIED-AR.md`
