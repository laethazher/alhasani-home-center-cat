# التطوير الموحّد — نظام واحد، منفذ واحد

## الفكرة

| | التطوير | الإنتاج (Render) |
|---|---------|------------------|
| **البوابة + المنصّة** | `http://localhost:3000/` | خدمة KM على Render |
| **نظام المركبات** | `http://localhost:3000/system` | خدمة Fleet على Render (أو `/system` لاحقاً) |
| **قاعدة البيانات** | Supabase مشترك — schema `km` معزول | نفس المشروع |

## تشغيل التطوير (أمر واحد)

```powershell
cd "C:\Users\AWJ-HAIDERMUTHANA\Desktop\HOME 2"
npm run dev:unified
```

يفتح:
- **/** — بوابة + أكاديمية + معرفة
- **/system** — نظام المركبات (Vite)

> لا تشغّل `npm run dev` في المجلدين منفصلين — استخدم `dev:unified` فقط.

## `.env.local` للمنصّة

```
NEXT_PUBLIC_SYSTEM_URL=
```

(فارغ = `/system` تلقائياً في التطوير)

## Render (حالياً)

خدمتان منفصلتان على Render — كل واحدة بمتغيّراتها.  
لدمج استضافة واحدة لاحقاً: اضبط `NEXT_PUBLIC_SYSTEM_URL=/system` وابنِ Fleet تحت `/system/`.
