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

---

## Render (إنتاج — سيرفر واحد)

**خدمة واحدة:** `alhasani-home-center-cat.onrender.com`

| المسار | المحتوى |
|--------|---------|
| `/` | البوابة |
| `/academy` | الأكاديمية |
| `/system` | نظام المركبات |

**Build:** `npm run build:unified`  
**Start:** `npm run start:unified`

دليل النشر: [`RENDER-DEPLOY-AR.md`](../RENDER-DEPLOY-AR.md)

```powershell
npm run render:env   # طباعة متغيّرات Render
```

---

## أوامر مفيدة

```powershell
npm run dev:unified       # تطوير موحّد
npm run build:unified     # بناء إنتاج موحّد (محلياً)
npm run start:unified     # تشغيل إنتاج موحّد (محلياً)
npm run db:test           # فحص DB
npm run sync:content      # مزامنة الكتب
```

دليل التطوير: `DEV-UNIFIED-AR.md`
