# AUDIT-PROGRESS — بازبینی سایر بخش‌های پروژه (بک‌اند)

> **هدف این فایل:** اگر چت قطع شد، چت جدید با خواندن همین فایل بداند چه کارهایی انجام شده،
> چه چیزی مانده و چطور ادامه دهد. **در حین کار مداوم به‌روز می‌شود.**
> آخرین به‌روزرسانی: پایان تسک — آماده‌ی مرج (تاریخ: ۲۰۲۶-۰۸-۰۷)

---

## ✅ وضعیت نهایی — تسک بک‌اند کامل است

- **بازبینی عمیق بک‌اند (۲۵ باگ واقعی رفع شد)** — جزئیات کامل در بخش‌های پایین همین فایل.
- **پوش نهایی روی `arena/019fdc95-zone-1-0-0`:**
  - `d9cfcbf` — همه‌ی اصلاحات بک‌اند (api/ws/worker/packages + lockfile)
  - `b0ffe44` — همین فایل ردیاب
  - `8d8dab7` — جاب «Build Backend» در workflow (**خود کاربر دستی اعمال کرد**؛ توکن App اجازه نداشت)
- **CI روی PR #10 همه سبز:** Build Backend (جدید، ۵۰s) ✅ / Android APK ✅ / iOS ✅ / Greptile ✅
- **قدم بعدی: کاربر PR #10 را به main مرج می‌کند و چت جدید شروع می‌شود.**
- نکته‌ی بهداشتی CI (اختیاری، غیرفوری): هشدار «Node.js 20 deprecated» روی actions — در آینده setup-node و checkout را به نسخه‌ی جدید بردار (یا ورژن ورکفلو را به‌روز کن).

---

## زمینه کلی (قوانین مهم این سندباکس)

- ریپو: `paymanshafayan/Zone-1.0.0` — برنچ کاری ثابت: `arena/019fdc95-zone-1-0-0` (فقط همین برنچ).
- مونورپو: pnpm + turbo — ورک‌اسپیس‌ها: `apps/*`, `packages/*`, `plugins/*`.
- **Node v22 + pnpm 10 در سندباکس موجود است** (اما Flutter/Dart نداریم — فقط برای بک‌اند تایپ‌اسکریپت قابل اجراست).
- دسترسی شبکه محدود: github.com و raw.githubusercontent باز؛ رجیستری npm و بیشتر هاست‌ها **نامشخص/احتمالاً بسته** — قبل از هر فرضی `pnpm install` را تست کن.
- **توکن GitHub App اجازه‌ی ویرایش workflow ندارد** → پوش تغییرات `.github/workflows/*` ریجکت می‌شود. راه‌حل: محتوای workflow آماده به کاربر داده شود تا خودش اعمال کند.
- کاربر فارسی‌زبان است؛ گزارش نهایی فارسی با جدول.
- نتیجه‌ی تسک قبلی (موبایل): همه‌ی چک‌های PR #10 سبز؛ باگ‌های ران‌تایم موبایل در کامیت `c0fd5aa` رفع شد.
- هر پوش به `arena/019fdc95-zone-1-0-0` روی PR #10 ران CI را دوباره تریگر می‌کند.

## وضعیت فعلی CI (در شروع این تسک)

- workflow: `.github/workflows/main.yml` — جاب‌ها: `Build Android APK` + `Build iOS App (No Codesign)` (Flutter 3.44.8, Java 17, API 34) + Greptile. **همه سبز** روی کامیت `c0fd5aa`.

## محدوده‌ی بازبینی این تسک

1. `apps/api` — REST API
2. `apps/ws` — WebSocket server (بخشی از آن در تسک موبایل بررسی شد)
3. `apps/worker` — background jobs
4. `packages/assistant`, `packages/core`, `packages/db`, `packages/redis`, `packages/sdk`, `packages/tags`, `packages/voice`
5. `plugins/professional`, `services`, `social`, `support`, `verification`
6. `src/`, `scripts/`, `infra/` (Docker / compose / init-db)
7. **در انتها: اضافه کردن جاب «Build Backend» به workflow** (با توجه به محدودیت توکن، اگر پوش ریجکت شد، فایل آماده به کاربر تحویل داده می‌شود)

---

## لاگ کار (به‌ترتیب انجام)

- [x] مشخصات فایل پیگیری اعلام و فایل ساخته شد: `docs/AUDIT-PROGRESS.md`
- [x] بررسی ساختار ورک‌اسپیس و تست `pnpm install` — موفق (رجیستری npm باز است).
      **نکته اجرایی:** باینری pnpm روی PATH نیست → اول `corepack enable` بزن (شیم‌ها می‌سازد)، بعد `pnpm ...` مستقیم کار می‌کند (نسخه 9.15.9).
- [x] **Baseline build:** `pnpm build` (turbo، ۱۵ پکیج) → **همه ۱۵ پکیج بدون خطا build شدند** ✅
      (در محدوده: api, assistant, core, db, plugin-×5, redis, sdk, tags, voice, worker, ws)
      پس خطای کامپایل نداریم؛ تمرکز روی باگ‌های منطقی/ران‌تایم.
- [ ] بازبینی `apps/api` — در حال انجام. یافته‌های اولیه‌ی ناسازگاری قرارداد با کلاینت موبایل:
      ۱) `POST /api/voice/process` سرور فیلد `requesterId` می‌خواهد و `responseText` برمی‌گرداند؛ موبایل `personId` می‌فرستد و `response`/`mode` می‌خواند → پاسخ اصلی زون همیشه از دست می‌رود (بحرانی).
      ۲) `GET /api/posts` سرور `page/pageSize` می‌خواهد؛ موبایل `limit/offset` می‌فرستد → pagination فید شکسته (همیشه ۲۰ تای اول + تکراری‌ها).
      ۳) `POST /api/professional/register` سرور `{zoneId, license, planId}` می‌خواهد؛ موبایل `{profession, licenseNumber, licenseImageUrl}` می‌فرستد → ثبت‌نام همیشه fail.
      ۴) `activate`/`renew` هم با موبایل ناسازگار (subscriptionId/planId).
      ۵) `/health` بدون پیشوند `/api` (موبایل `/api/health` می‌زند).
      ۶) `tags/branch` سرور query می‌خواهد؛ موبایل path. ۷) `tags/demand` سرور `concept`؛ موبایل `tagPath`. ۸) `learning/demands` سرور `requesterId`؛ موبایل `personId`.
      استراتژی رفع: سرور را **سازگار با هر دو شکل** می‌کنیم (تست‌های test-phase5..9 نباید بشکنند).
- [ ] بازبینی `apps/ws`
- [ ] بازبینی `apps/worker`
- [ ] بازبینی packages: assistant / core / db / redis / sdk / tags / voice
- [ ] بازبینی plugins: professional / services / social / support / verification
- [ ] بازبینی `src/` + `scripts/` + `infra/`
- [ ] رفع باگ‌های پیداشده + کامیت/پوش
- [ ] افزودن جاب بیلد بک‌اند به workflow ( یا تحویل فایل به کاربر )
- [ ] گزارش نهایی فارسی

## یافته‌ها و رفع‌ها (به‌تدریج پر می‌شود)

### ناسازگاری قرارداد API ↔ موبایل (تأییدشده با خواندن کد هر دو طرف)
1. `POST /api/voice/process`: موبایل `personId` می‌فرستد (سرور `requesterId` می‌خواست) و کلیدهای `response` + `mode` (حروف بزرگ: KNOW/ASK/UNKNOWN) می‌خواند؛ سرور فقط `responseText` + `modeResult.mode` (کوچک) می‌داد → پاسخ اصلی همیشه «ببخشید متوجه نشدم». رفع: هر دو کلید در خروجی + پذیرش personId.
2. `GET /api/posts`: موبایل `limit/offset` و `tag` تکی می‌فرستد؛ سرور `page/pageSize` + `tags`. رفع: پذیرش هر دو.
3. `POST /api/posts`: موبایل `providerName` نمی‌فرستد → undefined ذخیره می‌شد. رفع: پیش‌فرض `providerName = providerId` (در روت و سرویس).
4. `POST /api/professional/register`: موبایل `{personId, profession, licenseNumber, licenseImageUrl}`؛ سرور `{personId, personName, zoneId, license, planId}` می‌خواست → همیشه خطا. رفع: سرور هر دو شکل را بپذیرد (پیش‌فرض‌ها: personName=personId, zoneId=zone_default, planId=monthly).
5. `POST /api/professional/activate`: موبایل `personId+planId+paymentReference`؛ سرور فقط `subscriptionId`. رفع: یافتن جدیدترین اشتراک pending کاربر.
6. `POST /api/professional/renew`: planId موبایل نمی‌فرستد. رفع: اختیاری شد (پیش‌فرض طرح فعلی).
7. `GET /api/professional/status/:personId`: موبایل `professionalStatus` می‌خواند. رفع: کلید alias اضافه شد.
8. `POST /api/professional/license/verify`: موبایل `verifiedBy` نمی‌فرستد. رفع: پیش‌فرض 'system'.
9. موبایل `/api/health` می‌زند؛ سرور فقط `/health` داشت. رفع: alias.
10. `GET /api/tags/branch/:branch` (path) در موبایل؛ سرور فقط query. رفع: روت جدید.
11. `POST /api/tags/demand`: موبایل `tagPath`؛ سرور `concept`. رفع: alias.
12. `GET /api/learning/demands`: موبایل `personId`؛ سرور `requesterId`. رفع: alias.
13. `GET /api/memories/stats` موبایل بدون zoneId می‌زند؛ سرور اجباری می‌خواست. رفع: اختیاری + تجمیع.
14. سرور همه‌ی خطاها را با HTTP 200 + `{error}` برمی‌گرداند → موبایل (Dio) هیچ خطایی نمی‌بیند و خطای واقعی «موفق» نمایش داده می‌شد. رفع: reply.status(400/404) با همان بادی.

### باگ‌های منطقی/ران‌تایم سرویس‌ها
15. `VoicePipeline` کانستراکتور `new MemoryService()/new PostService()/ResponseModeEngine(toolExecutor)` خودش می‌ساخت → `/api/voice/process` روی پایگاه‌ی خالی کار می‌کرد (KNOW mode هیچ‌وقت؛ شمارش پست همیشه ۰). رفع: تزریق وابستگی در کانفیگ + استفاده در apps/api.
16. `ToolExecutor` در apps/api با `waveService: null` → `open_wave` فقط spaceId فیک می‌ساخت؛ نه فضای شنوایی واقعی در Redis، نه job موج در صف BullMQ `zone:waves` (که apps/worker منتظرش است). رفع: adapter واقعی (همان layout ردیس ws: `space:{id}` JSON + TTL ثانیه‌ای) + enqueue به BullMQ. نیازمند افزودن bullmq به apps/api.
17. `hearing-space-service.findSpaces(zoneId, [])`: با تگ خالی `tags.some(...)` همیشه false → لیست فضاها همیشه خالی (بحرانی: کلاینت همیشه tags:[] می‌فرستد). رفع: `tags.length === 0 ||` . همچنین فقط مپ in-memory را می‌گشت → hydrate از Redis (`getKeys('space:*')`).
18. `createPersistentSpace` رکورد ردیس را با TTL هفت‌روزه می‌نوشت → فضای «ماندگار» خودکار محو می‌شد. رفع: بدون TTL.
19. `joinSpace/speak/leaveSpace` فقط `this.spaces.get` (حافظه‌ی محلی) → فضای ساخته‌شده توسط پروسه‌ی api (موارد ۱۶) غیرقابل join بود. رفع: استفاده از `getSpace()` (fallback به ردیس).
20. `PostService`: پست بدون تگ معتبر هرگز در index نمی‌رفت → در فید بدون فیلتر و شمارش هم غایب بود. رفع: در حالت بدون فیلتر روی خود map با filter zoneId پیمایش.
21. `EdgeProcessor.detectIntent` سرور الگوهای KNOW موبایل (`بلدم`، `می‌تونم`...) را نداشت و در تساوی به سمت ASK می‌رفت → خوداظهاری مهارت «من بلدم» موج باز می‌کرد. رفع: الگوهای KNOW موبایل + tie-break به نفع KNOW (مطابق موبایل) + در `processTextInput` شاخه‌ی KNOW حالا واقعاً حافظه‌ی خوداظهاریه ثبت می‌کند (قبلاً فقط می‌گفت «یادداشت کردم» ولی هیچی ذخیره نمی‌شد).

### تأییدهای «OK بودن» (بدون نیاز به رفع)
- پروتکل WS ({type,payload}) با موبایل هماهنگ است؛ EventBus/PluginRegistry/Logger درست‌اند.
- plugins/*: skeleton با TODO هستند — فاقد رفتار ران‌تایم خراب؛ نگه‌داشته شدند.
- infra (Dockerfile multi-stage + compose + init-db.sql) سازگار است؛ نوـــــته: Dockerfile فقط apps/packages/plugins را کپی می‌کند.
- `src/app.js` + `scripts/testConnection.js`: **کد قدیمیِ مرحله‌ی صفر (Express+Mongo)** هستند؛ عضو ورک‌اسپیس/CI نیستند و خراب‌اند (require به utils/logger ناموجود؛ testConnection عملاً محتوای README است). تصمیم: دست نخوردند و به‌عنوان legacy مستند شدند (حذف آن‌ها ریسک ریویو دارد؛ در گزارش نهایی پیشنهاد حذف داده می‌شود).
- `apps/api/src/test-phase{5..9}.ts`: تست‌های سطح سرویس (بدون HTTP) — با تغییرات ما سازگارند.

### باگ‌های اضافه‌ای که حین smoke-test محلی پیدا و رفع شد
22. **نام صف BullMQ نامعتبر:** `zone:waves` شامل `:` بود → BullMQ v5 هنگام boot خطای `Queue name cannot contain :` می‌دهد → **apps/worker اصلاً بالا نمی‌آمد** (بحرانی؛ فقط با اجرای واقعی هم نصیبه شد). رفع: تغییر به `zone-waves` در apps/worker و apps/api.
23. **تعارض آستانه‌ی KNOW با decay زمانی:** موتور تصمیم با confidence خام ۰٫۵ تصمیم KNOW می‌گرفت، ولی ابزار با همان آستانه روی «credibilityِ افت‌کرده» (همیشه کمتر از confidence) جستجو می‌کرد → حافظه‌های دقیقاً-مرزی بلافاصله محو می‌شدند و پاسخ KNOW متن خالیِ «کسی رو نمی‌شناسم» می‌داد. رفع: حاشیه‌ی ۰٫۱ در آستانه‌ی fetch ابزار (response-modes.ts).
24. **false positive تگ emergency:** کلمه‌ی «خون» زیررشته‌ی «خونه» است → «یه نقاش برای خونه می‌خوام» تگ urgency/emergency می‌گرفت (موج فوریت اشتباه!). رفع: تطابق تمام‌کلمه برای کلمات پرخطر کوتاه (includesWholeWord، مرز = غیرحرف فارسی U+0621–U+06D2).
25. **تشخیص intent خوداظهاری/نفی:** «نمی‌شناسم» به‌دلیل زیررشته‌ی «می‌شناسم» KNOW می‌گرفت؛ تگ +۲ روی هر جمله ASK جعل می‌کرد. رفع: حذف negation پیش از اسکور، حذف بونوس تگ، tie-break KNOW مطابق موبایل، حالا خوداظهاری واقعاً حافظه ثبت می‌کند و پرسش بعدی همان مهارت → KNOW واقعی می‌دهد («یکی ali رو معرفی کرد»). ✅ smoke-test کامل چرخه.

### نتایج اعتبارسنجی (۲۰۲۶-۰۸-۰۷)
- `pnpm build` (۱۵ پکیج) ✅ / `pnpm type-check` (۲۲ تسک) ✅ / `pnpm install` با bullmq جدید ✅
- test-phase5,7,8,9 سبز (فاز ۶: ۱۲ شکست، **هم در baseline هم بعد از تغییرات** — محیطی است: ساعت سکوت ۲۲:۰۰–۰۸:۰۰ به وقت ایران؛ ساعت سندباکس ۲۲:۵۷ تهران بود).
- smoke-test API (بدون ردیس؛ degradate امن): health هر دو مسیر ۲۰۰، voice/process (response/mode درست)، چرخه‌ی KNOW→memory→ASK، extract-tags بدون emergency کاذب، پست (create/فید mobile shape/فیلتر تگ/untagged/count=2)، register→verify→activate→status→renew با شکل‌های موبایل، ۴۰۰/۴۰۴ واقعی، spaces با ردیس پایین → 503 تمیز به‌جای کرش.
- نکته: mode تصمیم KNOW-اشتراکی اکنون 'KNOW' برمی‌گردد (قبلاً UNKNOWN).

### موارد باقی‌مانده/پیشنهادی (خارج از scope فعلی)
- واژگان تگ موبایل با سرور ناهماهنگ (موبایل services/tutoring, social/tea... دارد؛ سرور closed-vocabulary دیگری). پیشنهاد: تراز map موبایل با packages/tags یا افزودن این برچسب‌ها از مسیر demand.
- تست فاز ۶ مستقل از ساعت شود (ساعت قابل‌تزریق به AntiNuisanceService).
- `src/app.js` و `scripts/testConnection.js` legacy/خراب خارج از ورک‌اسپیس‌اند؛ پیشنهاد حذف در PR جدا.
- WS+worker+api با ردیس واقعی فقط در مرحله‌ی compose قابل تست‌اند (سندباکس ردیس ندارد).

### کارهای انجام‌شده در این مرحله
- [x] رفع موارد ۱-۲۵
- [x] اجرای تست‌ها و smoke-test محلی API
- [x] جاب «Build Backend» در workflow (main.yml: corepack/pnpm install --frozen-lockfile + pnpm build + pnpm type-check؛ paths به backend extend شد)
- [x] گزارش نهایی

### وضعیت پوش و گیت (۲۰۲۶-۰۸-۰۷ — نهایی)
- **پوش شد:** `d9cfcbf` (backend fixes، ۱۱ فایل +۱۰۰۲/−۲۱۰) روی `arena/019fdc95-zone-1-0-0` ✅ → CI روی PR #10 تریگر می‌شود.
- **جاب Build Backend هم‌اکنون به‌صورت «تغییر لوکال بدون کامیت» در `.github/workflows/main.yml` موجود است** (مثل هر بار دیگر: توکن GitHub App اجازه‌ی ویرایش workflow را ندارد → remote rejected «without workflows permission»). محتوای آماده‌ی تغییر workflow در چت به کاربر تحویل داده شد تا دستی اعمال کند. خاطی اعتیاد: git status فایل workflow را «M» نشان می‌دهد — عمدی است؛ دور نینداز!
- توکن GitHub سندباکس خودش اوکی بود (هشدار اولیه‌ی 401 لحظه‌ای/تازه‌سازی توکن بود).

## نکات فنی جمع‌آوری‌شده در راه (برای ادامه‌ی کار در چت جدید)

- پروتکل واقعی WS سرور (`apps/ws`) — کلاینت→سرور: `{type, payload}` با type در:
  `identify | join | leave | speak | list_spaces | ping`
  سرور→کلاینت: `identified | joined | left | reverberation | speech | presence | space_list | system | error | pong`
  (این در تسک موبایل کشف و کلاینت موبایل با آن هماهنگ شد — کامیت `c0fd5aa`)
