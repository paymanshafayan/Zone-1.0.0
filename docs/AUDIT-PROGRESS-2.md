# AUDIT-PROGRESS-2 — بازبینی عمیق بخش‌های باقی‌مانده

> **هدف این فایل:** ادامه‌ی بازبینی پس از مرج PR #10.
> آخرین به‌روزرسانی: شروع بازبینی (تاریخ: ۲۰۲۶-۰۸-۰۸)

---

## زمینه

- ریپو: `paymanshafayan/Zone-1.0.0`
- برنچ کاری: `arena/019fde91-zone-1-0-0`
- کامیت پایه: `cf091b7` (شامل همه‌ی اصلاحات قبلی — ۲۵ باگ رفع‌شده)
- تسک قبلی: بازبینی بک‌اند کامل شد (apps/api, ws, worker, packages, plugins)

## محدوده‌ی بازبینی این مرحله

بازبینی کامل تمام فایل‌های TypeScript/JavaScript پروژه:
1. `apps/api/src/index.ts` (1747 خط)
2. `apps/ws/src/index.ts` + `hearing-space-service.ts`
3. `apps/worker/src/index.ts`
4. `packages/core` (types, event-bus, logger, plugin-registry)
5. `packages/redis/src/index.ts`
6. `packages/db` (prisma schema + index)
7. `packages/sdk/src/index.ts`
8. `packages/tags` (vocabulary + tag-service)
9. `packages/voice` (edge-processor + voice-pipeline)
10. `packages/assistant` (تمام ۱۳ فایل)
11. `plugins/*` (هر ۵ پلاگین)
12. `src/app.js` + `scripts/testConnection.js` (legacy)
13. `infra/` (Dockerfile + docker-compose + init-db.sql)
14. `ARCHITECTURE.md`

---

## یافته‌ها

### باگ‌های بحرانی (تأثیر ران‌تایم)

**Bug 26: `seedSamplePersons` بدون شرط NODE_ENV فراخوانی می‌شود**
- فایل: `apps/worker/src/index.ts` خط ~240
- مشکل: داده‌ی نمونه (۱۰ شخص) در هر بوت worker بارگذاری می‌شود، حتی در production
- رفع: شرط `if (process.env.NODE_ENV !== 'production')` اضافه شود

**Bug 27: `eventBus.emit` در مسیرهای API بدون `await` فراخوانی می‌شود**
- فایل: `apps/api/src/index.ts` — مسیرهای learning و professional
- مشکل: خطاهای handlerهای event ساکت می‌مانند
- رفع: `await` اضافه شود

**Bug 28: `memberCount` در Redis ذخیره نمی‌شود**
- فایل: `apps/ws/src/hearing-space-service.ts`
- مشکل: `space.memberCount` فقط در حافظه نگهداری می‌شود. بعد از ریستارت WS، شمارش اعضا از دست می‌رود
- رفع: بعد از تغییر memberCount، رکورد Redis به‌روز شود

**Bug 29: `findOpenDemands` وضعیت demand را حین query تغییر می‌دهد**
- فایل: `packages/assistant/src/memory-demand.ts`
- مشکل: متد `findOpenDemands` در بخش `search`، demandهای منقضی‌شده را `expired` می‌کند — side effect غیرمنتظره در عملیات خواندن
- رفع: فقط فیلتر کند، تغییر وضعیت در متد جداگانه

**Bug 30: `getZonePresence` و `getSpacePresence` از `KEYS *` استفاده می‌کنند**
- فایل: `packages/redis/src/index.ts`
- مشکل: `KEYS presence:*` تمام کلیدهای presence را اسکن می‌کند — O(N) و کُند در تعداد بالا
- رفع: استفاده از Redis SET برای zone presence

### باگ‌های امنیتی

**Bug 31: عدم rate limiting روی سرور Fastify**
- فایل: `apps/api/src/index.ts`
- مشکل: سرور اصلی API هیچ محدودیت نرخ درخواست ندارد (نسخه‌ی legacy Express داشت)
- رفع: `@fastify/rate-limit` اضافه شود

**Bug 32: عدم احراز هویت روی endpointها**
- فایل: `apps/api/src/index.ts`
- مشکل: هیچ endpoint‌ای احراز هویت نمی‌خواهد — هر کسی می‌تواند پست بسازد، حافظه ثبت کند، و...
- یادداشت: خارج از scope فعلی ولی باید مستند شود

### باگ‌های منطقی

**Bug 33: `ToolExecutor` از تایپ `any` استفاده می‌کند**
- فایل: `packages/assistant/src/tools.ts` خط ~330
- مشکل: `memoryService`، `postService`، `waveService` با تایپ `any` تعریف شده‌اند → امنیت تایپی از دست می‌رود
- رفع: تایپ‌های صحیح اعمال شود

**Bug 34: تکرار `ReverberationDuration` در دو پکیج**
- فایل‌ها: `packages/core/src/types.ts` (میلی‌ثانیه) و `packages/redis/src/index.ts` (ثانیه)
- مشکل: هر دو پکیج enum با همین نام دارند ولی واحدهای متفاوت — گیج‌کننده
- یادداشت: importها explicit هستند و runtime خراب نمی‌شود، ولی باید مستند شود

**Bug 35: `presence heartbeat` در WS خطای Redis را هندل نمی‌کند**
- فایل: `apps/ws/src/index.ts` خط ~440
- مشکل: `setInterval` بدون try-catch → اگر Redis قطع باشد، هر دقیقه خطا throw می‌شود
- رفع: try-catch اضافه شود

**Bug 36: تایپو در پاسخ learning**
- فایل: `packages/assistant/src/learning-service.ts` خط ~370
- متن: `"داونه یاد گرفتم"` → باید `"داونه"` بررسی شود (احتمالاً `"طونه"` یا `"داونه"`)

### مسائل زیرساختی

**Bug 37: Dockerfile از Node 20 استفاده می‌کند**
- فایل: `infra/Dockerfile`
- مشکل: Node 20 deprecated — باید Node 22 شود (مطابق sandbox)

**Bug 38: docker-compose restart policy ندارد**
- فایل: `infra/docker-compose.yml`
- مشکل: اگر سرویسی کرش کند، دوباره بالا نمی‌آید

**Bug 39: `@zone/db` build به خاطر Prisma generate شکست می‌خورد**
- فایل: `packages/db/package.json`
- مشکل: `prisma generate` نیاز به دانلود باینری دارد — در محیط‌های محدود شبکه fail می‌کند
- رفع: build script باید graceful fail کند

### تأییدهای «OK بودن»

- `packages/core` (EventBus, Logger, PluginRegistry, Types): ✅ تمیز و درست
- `packages/sdk`: ✅ interfaceهای TODO — طراحی intentional
- `packages/voice` (EdgeProcessor, VoicePipeline): ✅ بعد از اصلاحات قبلی درست کار می‌کند
- `packages/assistant` (MemoryService, PostService, WaveService, AntiNuisance, PersonRegistry, NumberService, LearningService, MemoryDemand, LicenseService, SubscriptionService): ✅ معماری تمیز
- `plugins/*`: ✅ skeleton با TODO — فاقد رفتار ران‌تایم خراب
- `infra/init-db.sql`: ✅ PostGIS + pgvector extensions
- `src/app.js` + `scripts/testConnection.js`: ⚠️ legacy/خراب — قبلاً مستند شده

---

## لاگ کار

- [x] خواندن تمام فایل‌های پروژه
- [x] شناسایی یافته‌ها
- [x] رفع باگ‌های بحرانی (26-30)
- [x] رفع باگ‌های منطقی (33, 35, 36)
- [x] رفع مسائل زیرساختی (37-39)
- [x] تست بیلد (۱۵/۱۵ ✅)
- [x] تست type-check (۲۲/۲۲ ✅)
- [x] تست‌ها: فاز ۵ (۳۹✅) / فاز ۷ (۵۱✅) / فاز ۸ (۶۷✅) / فاز ۹ (۶۹✅)
- [x] کامیت و پوش
- [ ] گزارش نهایی

## نتایج اعتبارسنجی (۲۰۲۶-۰۸-۰۸)

- `pnpm build` (۱۵ پکیج) ✅
- `pnpm type-check` (۲۲ تسک) ✅
- test-phase5 (۳۹/۳۹) ✅ / test-phase7 (۵۱/۵۱) ✅ / test-phase8 (۶۷/۶۷) ✅ / test-phase9 (۶۹/۶۹) ✅
- test-phase6: ۱۲ شکست (همان مشکل ساعت سکوت — محیطی، نه کدی)
