# نشر Render — سيرفر واحد موحّد

## الرابط بعد النشر

| المسار | المحتوى |
|--------|---------|
| https://alhasani-home-center-cat.onrender.com/ | البوابة |
| .../academy | الأكاديمية |
| .../login | تسجيل الدخول |
| .../system | نظام المركبات |

---

## 1) حذف الخدمات الزائدة (اختياري)

احذف من Render Dashboard:
- `alhasani-home-center-caR`
- `alhasani-home-center-caE`

**احتفظ فقط:** `alhasani-home-center-cat`

---

## 2) Push الكود

```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2"
git add render.yaml scripts/build-unified.mjs scripts/start-unified.mjs serve.js package.json
git add al-hasani-km-platform/next.config.mjs al-hasani-km-platform/src/lib/system-url.ts
git commit -m "Unified production: single Render server for platform and fleet"
git push origin main
```

---

## 3) تحديث إعدادات `alhasani-home-center-cat`

Render → **alhasani-home-center-cat** → **Settings**:

| الحقل | القيمة |
|-------|--------|
| **Root Directory** | *(فارغ)* |
| **Build Command** | `npm install && cd al-hasani-km-platform && npm install && cd .. && npm run build:unified` |
| **Start Command** | `npm run start:unified` |

---

## 4) Environment Variables

```powershell
cd al-hasani-km-platform
npm run render:env
```

الصق في **Environment** لخدمة `alhasani-home-center-cat`، وتأكد من وجود:

```
UNIFIED_PROD=1
NEXT_PUBLIC_UNIFIED=1
NEXT_PUBLIC_SYSTEM_URL=/system
FLEET_INTERNAL_PORT=10001
AUTH_PROVIDER=supabase
NEXT_PUBLIC_AUTH_PROVIDER=supabase
DATABASE_URL=...
DIRECT_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GEMINI_API_KEY=...
```

---

## 5) Deploy

**Manual Deploy → Clear build cache & deploy**

انتظر **Deploy live** (قد يستغرق 10–15 دقيقة — build للتطبيقين).

---

## 6) التحقق

```
https://alhasani-home-center-cat.onrender.com/academy
https://alhasani-home-center-cat.onrender.com/system
https://alhasani-home-center-cat.onrender.com/login
```

---

## كيف يعمل

```
Render PORT (10000)
    └── Next.js  →  /  /academy  /login  /dashboard
            └── rewrite /system/*  →  Fleet داخلي :10001
```

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| Build failed | راجع Logs — DATABASE_URL مطلوب لـ Prisma |
| /system 404 | تأكد Start = `npm run start:unified` |
| /academy 404 | Build Command يجب أن يشمل `build:unified` |
| Login لا يعمل | `NEXT_PUBLIC_AUTH_PROVIDER=supabase` |

---

## التطوير المحلي (كما كان)

```powershell
npm run dev:unified
```
