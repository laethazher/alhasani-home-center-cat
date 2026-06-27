# البنية المعمارية — منصة إدارة المعرفة والامتثال
**مجموعة الحسني · Al-Hasani Knowledge & Compliance Platform**

هذه الوثيقة تغطّي: بنية النظام، تصميم قاعدة البيانات، هيكل المجلدات، خريطة الصفحات، رحلات المستخدمين، مواصفة الواجهة (UI/UX)، ومواصفة الواجهات البرمجية (API).

---

## 1. بنية النظام (System Architecture)

```
                          ┌────────────────────────────────────────────┐
                          │            المتصفح (RTL · عربي)             │
                          │   Next.js App Router · React 18 · Tailwind   │
                          └───────────────┬────────────────────────────┘
                                          │  HTTPS
                          ┌───────────────▼────────────────────────────┐
                          │         خادم Next.js (Node runtime)         │
                          │                                              │
                          │  ▸ Middleware (Edge): التحقق من JWT والحماية │
                          │  ▸ Server Components: قراءة عبر Repository    │
                          │  ▸ Route Handlers (/api): المنطق والتكاملات  │
                          │  ▸ RBAC: مصفوفة صلاحيات لكل دور              │
                          └──┬──────────┬──────────┬──────────┬─────────┘
                             │          │          │          │
                ┌────────────▼──┐  ┌────▼─────┐ ┌──▼──────┐ ┌─▼──────────┐
                │  PostgreSQL   │  │Elastic-  │ │ Qdrant  │ │  Claude    │
                │  + Prisma     │  │search    │ │ (vector)│ │  (Anthropic)│
                │ مصدر الحقيقة  │  │بحث نصي    │ │بحث دلالي │ │ RAG مُقيّد   │
                └───────────────┘  └──────────┘ └─────────┘ └────────────┘
                        │                                         ▲
                ┌───────▼────────┐      ┌──────────────┐          │
                │  S3 / MinIO    │      │ OCR (tesseract│──────────┘
                │ ملفات الوثائق  │─────▶│  أو Azure DI) │  استخراج النص للفهرسة
                └────────────────┘      └──────────────┘
```

**المبادئ المعمارية:**
- **مصدر حقيقة واحد:** PostgreSQL عبر Prisma. Elasticsearch وQdrant فهارس مشتقّة يُعاد بناؤها من قاعدة البيانات (`npm run search:index`).
- **نمط المحوّل (Adapter) والتدهور اللطيف (Graceful Degradation):** كل خدمة خارجية خلف واجهة (`SearchProvider`، `embed()`/`qdrantSearch()`، `runOcr()`). إن لم تتوفّر الخدمة يسقط النظام إلى بديل محلي دون انهيار.
- **وضعان للتشغيل:** `NEXT_PUBLIC_DEMO_MODE=true` (افتراضي) يشغّل التطبيق فوراً ببيانات مدمجة دون أي بنية تحتية؛ `false` يفعّل مسار الإنتاج الكامل.
- **حدود الخادم/العميل:** القراءات الحسّاسة في Server Components؛ التفاعل فقط في مكوّنات العميل. الأسرار لا تُرسَل إلى المتصفح إطلاقاً.
- **استرجاع مُعزَّز بالتوليد (RAG) مُقيّد:** المساعد يجيب حصراً من المقاطع المعتمدة المسترجَعة، ويستشهد برقم الوثيقة والصفحة.

**سلسلة معالجة الوثيقة عند الرفع:**
`رفع PDF` → `تخزين (S3/MinIO)` → `OCR لكل صفحة` → `حفظ ocrText على DocumentVersion` → `فهرسة في Elasticsearch` → `تقطيع (chunking)` → `تضمين (embeddings)` → `upsert في Qdrant`.

---

## 2. تصميم قاعدة البيانات (Database Design)

المخطّط الكامل في `prisma/schema.prisma`. الكيانات الأساسية:

| الكيان | الوصف | علاقات بارزة |
|---|---|---|
| **Department** | الأقسام الأربعة (تجهيز/تركيب/إدارة المخزون/الإدارة) | members → User، manager → User |
| **User** | الموظفون | role (ADMIN/MANAGER/EMPLOYEE)، department |
| **Document** | الوثيقة الرسمية | type، status، confidentiality، owner، department، currentVersion |
| **DocumentVersion** | إصدارات الوثيقة + `ocrText` + `pageCount` | uploadedBy |
| **Attachment** | مرفقات الوثيقة | document |
| **DocumentRelation** | الربط بين الوثائق (يشير/يحل محل/يكمّل/ينفّذ) | from/to → Document |
| **DocumentChunk** | مقاطع للفهرسة الدلالية + `qdrantPointId` | document، version |
| **Acknowledgement** | تتبّع الاطّلاع/القراءة/الإقرار | فريد (documentId, userId) |
| **Quiz / QuizQuestion / QuizOption / QuizAttempt** | نظام الاختبارات والنتائج | quiz ↔ document |
| **Sop / SopStep / SopMistake** | الإجراءات المنظّمة (خطوات/صور/فيديو/تحذيرات/أخطاء) | sop ↔ document |
| **AiConversation / AiMessage** | محادثات المساعد + الاستشهادات (JSON) | user |
| **Notification** | الإشعارات | user |
| **AuditLog** | سجلّ تدقيق غير قابل للتعديل | user |

**التعدادات (Enums):** `Role`, `DocumentType×6`, `DocumentStatus×5`, `Confidentiality×4`, `AckStatus×4`, `RelationType×4`, `QuestionType`, `SopSeverity`, `NotificationType`, `MessageRole`.

**الفهارس:** على `documentNumber`, `type`, `status`, `departmentId` (Document)؛ و(documentId, userId) فريد على Acknowledgement؛ وعلى role/department للمستخدمين — لدعم التصفية والبحث وتقارير الامتثال.

---

## 3. هيكل المجلدات (Folder Structure)

```
al-hasani-km/
├─ prisma/
│  ├─ schema.prisma          # المخطّط الكامل
│  └─ seed.ts                # بيانات أولية (مع تجزئة كلمات المرور)
├─ scripts/
│  └─ reindex.ts             # فهرسة Elasticsearch + Qdrant
├─ docker-compose.yml        # postgres · elasticsearch · qdrant · minio
├─ src/
│  ├─ middleware.ts          # حماية المسارات (Edge JWT)
│  ├─ app/
│  │  ├─ layout.tsx          # الجذر: RTL + الخطوط + الثيم
│  │  ├─ providers.tsx       # next-themes
│  │  ├─ login/page.tsx      # تسجيل الدخول
│  │  ├─ (app)/              # مجموعة المسارات المحمية (داخل الـ Shell)
│  │  │  ├─ layout.tsx       #   حارس الجلسة + AppShell
│  │  │  ├─ dashboard/
│  │  │  ├─ documents/[id]/
│  │  │  ├─ search/
│  │  │  ├─ assistant/
│  │  │  ├─ sops/[id]/
│  │  │  ├─ compliance/
│  │  │  └─ admin/
│  │  └─ api/                # auth · documents · search · ai/chat · compliance
│  ├─ components/
│  │  ├─ ui/                 # نظام التصميم (Card/Button/Badge/Donut…)
│  │  ├─ layout/             # Sidebar · Topbar · ThemeToggle · AppShell
│  │  ├─ dashboard/          # KPI + Charts (recharts)
│  │  ├─ documents/          # Browser + AcknowledgeButton
│  │  ├─ compliance/         # Quiz
│  │  └─ shared/             # PageHeader · AdminTabs
│  └─ lib/
│     ├─ auth.ts rbac.ts env.ts prisma.ts types.ts utils.ts constants.ts
│     ├─ data/               # users · sampleData · repository
│     ├─ search/             # searchService (ES + local)
│     ├─ ai/                 # assistant (RAG) · embeddings (Qdrant)
│     └─ ocr/                # ocrService (tesseract/azure)
└─ .env.example
```

---

## 4. خريطة الصفحات (Page Structure)

| المسار | الوصف | الوصول |
|---|---|---|
| `/login` | تسجيل الدخول (تصميم تنفيذي + حسابات تجريبية) | عام |
| `/dashboard` | لوحة تنفيذية: مؤشرات، رسوم، مهام معلّقة، أحدث الوثائق | الجميع |
| `/documents` | مكتبة الوثائق: بحث + تصفية + جدول/شبكة | الجميع |
| `/documents/[id]` | تفاصيل: ملخّص، معاينة، إصدارات، إقرار، مدى الوصول، ذات صلة | الجميع |
| `/search` | بحث موحّد متعدّد الحقول + تبديل دلالي | الجميع |
| `/assistant` | المساعد المعرفي (RAG) باستشهادات | الجميع |
| `/sops` · `/sops/[id]` | الإجراءات: خطوات/صور/فيديو/سير العملية/أخطاء شائعة | الجميع |
| `/compliance` | مراقبة الامتثال + الاختبارات | مدير قسم / مدير نظام |
| `/admin` | إدارة المستخدمين + رفع الوثائق | مدير النظام |

---

## 5. رحلات المستخدمين (User Journeys)

**الموظف (Employee):** يسجّل الدخول → يرى على اللوحة الوثائق التي تنتظر إقراره → يفتح تعميماً → يقرأه → يضغط «أقرّ بالاطّلاع» → يُحدَّث مؤشّر امتثاله. عند مواجهة مهمة ميدانية يفتح الإجراء (SOP) خطوة بخطوة، أو يسأل المساعد المعرفي فيحصل على إجابة مع المصدر والصفحة.

**مدير القسم (Manager):** يطّلع على لوحة الامتثال لقسمه → يرى من تأخّر عن الإقرار → يفتح وثيقة ليرى «مدى الوصول» (اطّلعوا/قرؤوا/أقرّوا) → ينشئ/يحدّث إجراءً أو يرفع وثيقة لقسمه.

**مدير النظام (Admin):** يدير الحسابات والأدوار → يرفع وثيقة جديدة (تمرّ بسلسلة OCR والفهرسة) → يتابع الامتثال على مستوى كل الأقسام → يراجع سجلّ التدقيق.

---

## 6. مواصفة الواجهة (UI/UX Specification)

- **اللغة الاتجاه:** عربي RTL على مستوى `<html dir="rtl">`؛ كل التخطيط والمحاذاة والرسوم معكوسة بشكل صحيح.
- **الهوية البصرية — «فخامة تنفيذية هادئة»:** لون مميِّز واحد منضبط (تركواز `#17B8A1`) فوق حياد رمادي/عاجي، وذهبي ثانوي نادر. عنصر التوقيع: شريط جانبي يميني مع لمسة «جملون» (gable) تحاكي شعار المجموعة.
- **الخطوط:** عناوين Cairo، ونص IBM Plex Sans Arabic / Tajawal، وأرقام `tabular-nums` للبيانات.
- **الوضعان الليلي/النهاري:** عبر متغيّرات CSS على `:root` و`.dark` مع `next-themes` و`darkMode:'class'`؛ نهاري عاجي دافئ، وليلي غرافيت.
- **أرضية الجودة:** استجابة كاملة حتى الجوال، تباين مقروء، حلقة تركيز واضحة للوحة المفاتيح، واحترام `prefers-reduced-motion`.
- **اللغة في الواجهة:** أفعال مباشرة، حالات فارغة إرشادية، وأخطاء تشرح السبب والحل.

---

## 7. مواصفة الواجهات البرمجية (API Specification)

كل المسارات تحت `/api` محميّة بالـ middleware (تتطلّب جلسة صالحة) عدا `auth/login`.

| الطريقة | المسار | الجسم/المعاملات | الاستجابة |
|---|---|---|---|
| POST | `/api/auth/login` | `{ email, password }` | `{ user }` + كوكي جلسة (HttpOnly) |
| POST | `/api/auth/logout` | — | `{ ok }` |
| GET | `/api/auth/me` | — | `{ user }` |
| GET | `/api/documents` | `?q&type&status&departmentId` | `{ count, documents[] }` (مُصفّاة حسب الدور) |
| GET | `/api/documents/[id]` | — | `{ document }` أو 404 |
| GET | `/api/search` | `?q&semantic=1&type&departmentId` | `{ count, results[] }` مع `matchedIn[]` |
| POST | `/api/ai/chat` | `{ message, history[] }` | `{ answer, citations[], relatedSops[] }` |
| POST | `/api/compliance/acknowledge` | `{ documentId, action: VIEWED\|READ\|ACKNOWLEDGED }` | `{ ok, status }` (+ AuditLog في الإنتاج) |

**الأمان:** JWT (HS256 عبر `jose`) في كوكي HttpOnly/SameSite؛ تجزئة كلمات المرور بـ bcrypt؛ RBAC مركزي في `lib/constants.ts` (مصفوفة `ROLE_PERMISSIONS`) ويُفرض عبر `can()`/`assertCan()`؛ ورؤية صفّية للوثائق حسب القسم والحالة والسرية.
