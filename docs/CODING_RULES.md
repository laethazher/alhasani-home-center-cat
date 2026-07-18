# قواعد التطوير — الحسني هوم سنتر / Coding Rules

> مرجع دائم لفريق التطوير ومساعد الذكاء الاصطناعي.  
> Last updated: March 2025

---

## 1. القواعد الأساسية / Core Rules

| # | القاعدة | Rule |
|---|---------|------|
| 1 | **الميزات بالعربي** — أي ميزة يطلبها المستخدم بالعربي تُنفَّذ بالكامل. | Any feature requested in Arabic must be implemented fully. |
| 2 | **الكود بالإنجليزي** — أسماء المتغيرات، الدوال، الملفات، الـ Types، والسلاسل التقنية بالإنجليزي. | Code (variables, functions, files, types, technical strings) must be in English. |
| 3 | **التعليقات** — يمكن كتابة التعليقات بالعربي لتوضيح الفكرة. | Comments may be in Arabic to clarify intent. |
| 4 | **التوافق** — التأكد أن كل الأكواد متوافقة مع Supabase و Render. | Ensure all code is compatible with Supabase and Render. |
| 5 | **بعد كل تعديل** — تنفيذ commit ثم push تلقائياً إلى GitHub. | After every change: run commit and push to GitHub. |
| 6 | **لا تعديل بدون أمر** — لا تغير أي شيء إلا بأمر صريح من المستخدم. | Do not change anything unless explicitly instructed. |

---

## 2. تعليمات إضافية (English)

- **Best practices:** Follow best coding practices.
- **Structure:** Maintain project structure (see `docs/PROJECT_STRUCTURE.md`).
- **Existing functionality:** Do not overwrite existing functionality unless instructed.
- **Complete files:** Generate complete files when needed, not just snippets.
- **Major changes:** Explain major changes before committing.

---

## 3. السياق التقني / Tech Context

- **Repo:** GitHub  
- **Database & Auth:** Supabase (PostgreSQL, Auth, RLS)  
- **Deploy:** Render (build: `npm run build`, start: `npm start` → `serve.js`)  
- **Stack:** React 19, Vite 6, TypeScript, Tailwind CSS 4  

---

## 4. مراجع / References

- هيكلية المشروع والربط مع Supabase و Render: `docs/PROJECT_STRUCTURE.md`
- إعداد النشر: `render.yaml`
- عميل Supabase والأنواع: `src/lib/supabaseClient.ts`
