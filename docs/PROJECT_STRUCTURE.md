# ملخص هيكلية المشروع — الحسني هوم سنتر

> **Alhasani Home Center** — نظام إدارة المركبات والمعدات وإخراج الكادر  
> آخر تحديث: مارس 2025

---

## 1. نظرة عامة

| العنصر | الوصف |
|--------|--------|
| **المشروع** | SPA (Single Page Application) — واجهة عربية RTL |
| **المستودع** | GitHub |
| **قاعدة البيانات والـ Auth** | Supabase (PostgreSQL + Auth) |
| **النشر** | Render (Static/Web Service) |
| **التقنيات** | React 19, Vite 6, TypeScript, Tailwind CSS 4, Supabase JS |

---

## 2. هيكل الملفات

```
HOME 2/
├── index.html                 # نقطة دخول الـ SPA
├── package.json               # التبعيات وسكربتات التشغيل
├── vite.config.ts             # إعدادات Vite (React, Tailwind, env)
├── tsconfig.json              # إعدادات TypeScript
├── tailwind.config.js         # إعدادات Tailwind
├── .env.example               # مثال للمتغيرات (لا يحتوي مفاتيح Supabase)
├── .gitignore
├── render.yaml                # إعداد النشر على Render
├── server.ts                  # خادم التطوير: Express + Vite + SQLite (تقارير محلي)
├── serve.js                   # خادم الإنتاج: تقديم مجلد dist فقط
│
├── src/
│   ├── main.tsx               # نقطة دخول React
│   ├── App.tsx                # البوابة: تحميل، تسجيل دخول، حماية الصفحات حسب الدور
│   ├── index.css              # أنماط عامة + Tailwind
│   │
│   ├── lib/
│   │   ├── supabaseClient.ts  # عميل Supabase الوحيد + كل الأنواع (Types)
│   │   └── utils.ts           # دالة cn() للـ classNames
│   │
│   ├── hooks/
│   │   └── useUserProfile.ts  # الجلسة + البروفايل من Supabase Auth و user_profiles
│   │
│   ├── constants.ts           # عناصر الفحص الأسبوعي + أدوات الجرد (عربي)
│   │
│   ├── components/
│   │   ├── Layout.tsx         # الهيكل: شريط جانبي، تنقل، وضع داكن، تسجيل خروج
│   │   ├── DashboardCard.tsx  # بطاقة لوحة التحكم
│   │   ├── DamageMap.tsx     # خريطة الأضرار في التقارير
│   │   ├── InspectionForm.tsx # نموذج الفحص الأسبوعي
│   │   ├── ToolInventory.tsx  # جرد الأدوات + صور
│   │   ├── SignaturePad.tsx   # لوحة التوقيع
│   │   └── ImageCapture.tsx  # التقاط الصور
│   │
│   └── pages/
│       ├── LoginPage.tsx      # تسجيل الدخول (بريد/كلمة مرور)
│       ├── Dashboard.tsx     # لوحة التحكم (بطاقات للتنقل)
│       ├── Reports.tsx       # التقارير: إنشاء، عرض، تصدير PDF/Excel
│       ├── Vehicles.tsx      # إدارة المركبات + الصيانة
│       ├── VehicleHistory.tsx# سجل مركبة واحدة
│       ├── StaffExit.tsx     # إخراج الكادر (طلبات خروج، موافقة، تأكيد خروج)
│       ├── Violations.tsx    # سجل المخالفات (تأخر العودة)
│       └── UsersManagement.tsx # إدارة المستخدمين (واجهة فقط — قيد التطوير)
│
├── supabase/
│   ├── config.toml            # إعداد Supabase المحلي
│   └── migrations/            # ترتيب الهجرات (الجداول، RLS، المحفزات)
│       ├── 20260302143000_create_tables.sql
│       ├── 20260302144000_enable_rls.sql
│       ├── 20260302145000_policy_insert_reports.sql
│       ├── 20260302150000_policy_select_reports.sql
│       ├── 20260302151000_policy_manager_select_reports.sql
│       ├── 20260302152000_policy_admin_reports.sql
│       ├── 20260302153000_policy_user_profiles.sql
│       ├── 20260302154000_trigger_new_user.sql
│       ├── 20260302155000_policy_admin_profiles.sql
│       ├── 20260302160000_fix_rls_recursion.sql
│       ├── 20260302161000_fix_get_my_role_plpgsql.sql
│       ├── 20260302162000_jwt_based_rls.sql
│       ├── 20260302163000_debug_list_policies.sql
│       ├── 20260302164000_drop_stale_studio_policies.sql
│       ├── 20260303100000_staff_exit_system.sql
│       ├── 20260303100100_seed_staff_members.sql
│       ├── 20260303100200_add_gate_guard_role.sql
│       ├── 20260303100300_enhance_exit_requests.sql
│       ├── 20260303100400_seed_vehicles.sql
│       ├── 20260304100000_exit_type_and_duration.sql
│       ├── 20260304200000_enhance_vehicles.sql
│       ├── 20260304200100_fix_vehicles_rls.sql
│       ├── 20260304210000_vehicle_events.sql
│       └── 20260304200200_add_has_logo.sql
│
└── docs/
    └── PROJECT_STRUCTURE.md   # هذا الملف
```

---

## 3. الربط مع Supabase

### 3.1 العميل والبيئة

- **الملف:** `src/lib/supabaseClient.ts`
- **المتغيرات المطلوبة (في وقت البناء على Render):**
  - `VITE_SUPABASE_URL` — عنوان مشروع Supabase
  - `VITE_SUPABASE_ANON_KEY` — المفتاح العام (anon key)
- يتم إنشاء العميل مرة واحدة ويُصدَّر كـ `supabase`. كل استدعاءات Supabase (Auth و PostgREST) تمر عبر هذا الملف.

### 3.2 المصادقة (Auth)

| الوظيفة | الملف | الوصف |
|---------|--------|--------|
| تسجيل الدخول | `LoginPage.tsx` | `supabase.auth.signInWithPassword({ email, password })` |
| الجلسة والبروفايل | `useUserProfile.ts` | `getSession()` ثم جلب الصف من `user_profiles` حسب `auth.uid()` |
| الاستماع لتغيير الحالة | `useUserProfile.ts` | `onAuthStateChange` — تحديث المستخدم والبروفايل |
| تسجيل الخروج | `useUserProfile.ts` | `supabase.auth.signOut()` |

- لا يوجد OAuth (مثلاً Google)؛ `detectSessionInUrl: false`.
- المستخدم يعتبر "مسجّل دخوله" فقط إذا وُجد `user` و`profile` من Supabase.

### 3.3 الجداول والصلاحيات (RLS)

| الجدول | الغرض | ملاحظات RLS |
|--------|--------|-------------|
| **auth.users** | مستخدمي Supabase Auth | يُدار من Supabase |
| **user_profiles** | الاسم، الدور (admin, driver, manager, warehouse, logistics, gate_guard) | المستخدم يقرأ/يحدّث نفسه؛ الأدمن يقرأ/يحدّث/يدخل الكل. الدور يُنسخ إلى JWT |
| **vehicles** | بيانات المركبات (لوحة، نوع، حالة، سائق معيّن، إلخ) | سياسات حسب الدور (قراءة/كتابة للأدمن) |
| **vehicle_maintenance** | سجل الصيانة لكل مركبة | قراءة للجميع؛ إدخال/تحديث/حذف للأدمن |
| **vehicle_events** | أحداث المركبة (تعيين سائق، تغيير حالة، إلخ) | تُستخدم للتدقيق والسجل |
| **reports** | تقارير الفحص (سائق، أضرار، أدوات، توقيعات) | إدخال: نفس المستخدم (user_id = auth.uid())؛ قراءة: مدير/أدمن حسب السياسات |
| **staff_members** | السائقون والمساعدون (لنظام الخروج) | قراءة للمصادقين؛ إدارة كاملة للأدمن |
| **exit_requests** | طلبات إخراج الكادر | قراءة للمصادقين؛ إدخال/تحديث/حذف للأدمن؛ حارس البوابة يحدّث (مثلاً تأكيد الخروج) ضمن شروط محددة |

- **مهم:** الدور يُخزَّن في `user_profiles.role` ويُنسخ إلى `auth.users.raw_app_meta_data.user_role` عبر محفزات، وتقرأ السياسات من JWT: `auth.jwt() -> 'app_metadata' ->> 'user_role'` لتجنب الاستعلام عن `user_profiles` داخل RLS (ومنع التكرار اللانهائي).

### 3.4 استخدام Supabase في الصفحات

| الصفحة | الجداول/الوظائف |
|--------|------------------|
| **LoginPage** | `supabase.auth.signInWithPassword` |
| **useUserProfile** | `auth.getSession`, `auth.onAuthStateChange`, `auth.signOut`, `from('user_profiles').select()` |
| **Reports** | `from('reports').select()` و `from('reports').insert()` |
| **Vehicles** | `vehicles`, `vehicle_maintenance`, `staff_members`, `exit_requests` — قراءة/كتابة/حذف |
| **VehicleHistory** | `vehicles`, `vehicle_maintenance`, `vehicle_events`, `exit_requests`, `staff_members` |
| **StaffExit** | `exit_requests` (إدخال، تحديث، حذف)، `staff_members` للعرض |
| **Violations** | `exit_requests`, `staff_members` (قراءة فقط لاستنتاج المخالفات) |

---

## 4. الربط مع Render

### 4.1 ملف الإعداد: `render.yaml`

```yaml
services:
  - type: web
    name: alhasani-home-center-cat
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: VITE_SUPABASE_URL
        value: https://jxwzaoogmqzcqgnldwpm.supabase.co
      - key: VITE_SUPABASE_ANON_KEY
        value: <anon_key>
```

- **البناء:** `npm run build` → ينتج مجلد `dist/` (Vite يضمّن قيم `VITE_*` وقت البناء).
- **التشغيل:** `npm start` → يشغّل `node serve.js`.
- **serve.js:** يقدّم الملفات الثابتة من `dist/` ويعيد `index.html` لأي مسار (SPA fallback). لا يوجد Express API في الإنتاج؛ كل البيانات عبر Supabase من المتصفح.

### 4.2 التوافق مع Render

- التطبيق **ثابت من جهة الخادم** (Static): لا حاجة لبيئة Node تشغّل API.
- متغيرات **Vite** (`VITE_SUPABASE_*`) يجب أن تكون متوفرة **أثناء البناء** على Render (وهي مضبوطة في `envVars`).
- البورت: Render يحدد `PORT`؛ `serve.js` يستخدم `process.env.PORT || 3000`.

---

## 5. سكربتات التشغيل والبيئة

| السكربت | الأمر | الاستخدام |
|---------|--------|-----------|
| **dev** | `tsx server.ts` | تطوير محلي: Express + Vite middleware + SQLite لـ `/api/reports` |
| **build** | `vite build` | بناء الإنتاج → `dist/` |
| **start** | `node serve.js` | تشغيل خادم الإنتاج (استخدامه على Render) |
| **preview** | `vite preview` | معاينة بناء الإنتاج محلياً |
| **lint** | `tsc --noEmit` | فحص TypeScript بدون إخراج ملفات |

- في **التطوير:** واجهة التقارير في الكود تستخدم Supabase (إدراج وعرض من `reports`). مسارات `/api/reports` في `server.ts` اختيارية/للاستخدام المحلي مع SQLite.
- في **الإنتاج (Render):** لا يُشغَّل `server.ts`؛ كل العمليات تتم عبر Supabase.

---

## 6. الأدوار والصلاحيات في الواجهة

| الدور | الصفحات المتاحة | ملاحظات |
|------|-----------------|----------|
| **admin** | كل الصفحات (لوحة التحكم، مركبات، تقارير، إخراج كادر، مخالفات، مستخدمين، إعدادات) | كامل الصلاحيات في الواجهة |
| **driver, manager, warehouse, logistics** | لوحة التحكم، مركبات، إخراج كادر، تقارير | لا مستخدمين ولا إعدادات |
| **gate_guard** | لوحة التحكم، إخراج الكادر فقط | التطبيق يوجّهه تلقائياً لصفحة إخراج الكادر؛ القائمة الجانبية تعرض ما يناسبه |

- الحماية في `App.tsx`: إعادة توجيه من صفحة "مستخدمين" أو "إعدادات" إذا لم يكن المستخدم أدمن؛ إعادة توجيه حارس البوابة من أي صفحة غير لوحة التحكم وإخراج الكادر إلى إخراج الكادر.

---

## 7. ملاحظات للمطور

- **لا تكسر الوظائف الحالية:** أي تعديل على الجداول، RLS، أو تدفق المصادقة يجب أن يظل متوافقاً مع الهيكل الحالي.
- **الكود بالإنجليزي، التعليقات يمكن أن تكون بالعربي** لشرح الفكرة.
- **Supabase مصدر الحقيقة للمصادقة والبيانات** في الإنتاج؛ استخدم دائماً `supabaseClient.ts` والأنواع المُصدَّرة منه.
- **بعد أي تعديل مهم:** يُفضّل تنفيذ commit و push إلى GitHub مع رسالة واضحة وتوضيح التغييرات الكبيرة قبل الـ commit.

---

*هذا المستند يصف الهيكلية الحالية وارتباط المشروع بـ Supabase و Render دون تغيير في الكود.*
