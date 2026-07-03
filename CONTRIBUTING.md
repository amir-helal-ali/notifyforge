# Contributing to NotifyForge

شكراً لاهتمامك بالمساهمة في NotifyForge! هذا الدليل يشرح كيفية المساهمة في المشروع.

## 🚀 البدء السريع

```bash
# 1. اعمل fork للمشروع ثم clone
git clone https://github.com/<your-username>/notifyforge.git
cd notifyforge

# 2. ثبّت الاعتمادات
bun install

# 3. انسخ ملف البيئة
cp .env.example .env

# 4. اضبط قاعدة البيانات
bun run db:push
bun run db:generate

# 5. شغّل خادم التطوير
bun run dev
```

افتح http://localhost:3000 في المتصفح.

## 📋 قواعد المساهمة

### 1. قبل البدء
- ابحث في [Issues](https://github.com/notifyforge/notifyforge/issues) المفتوحة لتجنب التكرار.
- لفتح ميزة كبيرة، أنشئ Issue أولاً لمناقشتها.

### 2. فرع جديد
```bash
git checkout -b feat/your-feature-name     # للميزات الجديدة
git checkout -b fix/your-bug-fix           # لإصلاح الأخطاء
git checkout -b docs/your-docs-change      # للوثائق
```

### 3. معايير الكود

- **TypeScript صارم** — لا `any` بدون مبرر قوي.
- **ESLint نظيف** — `bun run lint` يجب أن يمر بدون أخطاء.
- **عزل القنوات** — كل قناة في ملف منفصل، لا مشاركة منطق أعمال بين القنوات.
- **لا توجيه بالذكاء الاصطناعي** — المنصة لا تقرر أي قناة تُستخدم أبداً.
- **TypeScript تعليقات JSDoc** لكل دالة عامة.

### 4. قبل الـ Commit

```bash
# تحقق من lint
bun run lint

# شغّل قاعدة البيانات المحلية للتأكد من أن الـ schema يعمل
bun run db:push

# اختبر التغييرات في المتصفح
bun run dev
```

### 5. صيغة رسائل Commit

نتبع [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add batch send endpoint for push channel
fix: correct APNs JWT signature encoding
docs: update SDK quickstart examples
refactor: extract provider clients into separate files
test: add integration tests for FCM client
chore: bump dependencies
```

### 6. Pull Request

- اشرح **ماذا** تغيّر و**لماذا**.
- اربط الـ PR بالـ Issue المرتبط (`Closes #123`).
- تأكد أن CI يمر بنجاح.
- لا ترفع ملفات `.env` أو مفاتيح خاصة.

## 🏗️ بنية المشروع

```
src/
├── app/
│   ├── api/v1/          # الـ API العام (15+ مسار)
│   ├── api/dashboard/   # API لوحة التحكم
│   └── page.tsx         # لوحة التحكم الموحدة
├── lib/
│   ├── channels/        # محركات القنوات (9 قنوات معزولة)
│   ├── providers/       # عملاء المزودين الحقيقيين (FCM, APNs, ...)
│   ├── infra/           # البنية التحتية (auth, rate-limit, queue, ...)
│   └── types.ts         # الأنواع المشتركة
└── components/dashboard/sections/  # أقسام لوحة التحكم
```

## 🧪 الاختبارات

```bash
# اختبارات الوحدة
bun test

# فحص lint
bun run lint

# فحص الأنواع
bunx tsc --noEmit
```

## 🔒 الإبلاغ عن الثغرات الأمنية

**لا تفتح Issue عام للثغرات الأمنية.** أرسل بريداً إلى `security@notifyforge.dev` بدلاً من ذلك.

## 📜 رخصة المشروع

بمساهمتك، فإنك توافق على أن مساهمتك ستُرخَّص تحت رخصة MIT.

## 🌍 مجموعة المساهمين

نرحب بالمساهمين من كل المستويات والخلفيات. كن محترماً وصبوراً ومتعاوناً.
