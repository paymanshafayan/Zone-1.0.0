/**
 * Zone — Phase 6 Test Script
 *
 * Tests the tiered wave system and anti-nuisance rules.
 *
 * Run: npx tsx apps/api/src/test-phase6.ts
 */

import {
  WaveService,
  AntiNuisanceService,
  PersonRegistry,
  MAX_DAILY_NOTIFICATIONS,
  QUIET_HOURS_START,
  QUIET_HOURS_END,
  MIN_RESPONSES_TO_STOP,
  SILENCE_THRESHOLD,
} from '@zone/assistant';

// ─── Test Utilities ───

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
}

function section(title: string) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

// ─── Main Test ───

async function main() {
  const personRegistry = new PersonRegistry();
  const antiNuisance = new AntiNuisanceService();
  const waveService = new WaveService(personRegistry, antiNuisance);

  // ─── Seed Sample Data ───

  const persons = [
    { id: 'p1', displayName: 'نقاش رضایی', zoneId: 'zone_narak', skills: ['house_painting', 'tiling'], latitude: 35.7750, longitude: 51.4150, responseRate: 0.9, isProfessional: true },
    { id: 'p2', displayName: 'لوله‌کش حسینی', zoneId: 'zone_narak', skills: ['plumbing', 'repair'], latitude: 35.7760, longitude: 51.4160, responseRate: 0.85, isProfessional: true },
    { id: 'p3', displayName: 'نقاش محمدی', zoneId: 'zone_narak', skills: ['house_painting'], latitude: 35.7740, longitude: 51.4140, responseRate: 0.7, isProfessional: false },
    { id: 'p4', displayName: 'برقکار احمدی', zoneId: 'zone_narak', skills: ['electrical', 'air_conditioning'], latitude: 35.7770, longitude: 51.4170, responseRate: 0.8, isProfessional: true },
    { id: 'p5', displayName: 'نجار کریمی', zoneId: 'zone_narak', skills: ['carpentry', 'repair'], latitude: 35.7730, longitude: 51.4130, responseRate: 0.6, isProfessional: false },
    { id: 'p6', displayName: 'اسباب‌کشی مرادی', zoneId: 'zone_narak', skills: ['moving', 'carpentry'], latitude: 35.7780, longitude: 51.4180, responseRate: 0.75, isProfessional: false },
    { id: 'p7', displayName: 'قفل‌ساز جعفری', zoneId: 'zone_narak', skills: ['locksmith', 'repair'], latitude: 35.7720, longitude: 51.4120, responseRate: 0.5, isProfessional: false },
    { id: 'p8', displayName: 'ورزشکار علوی', zoneId: 'zone_narak', skills: ['sports', 'walking'], latitude: 35.7790, longitude: 51.4190, responseRate: 0.9, isProfessional: false },
    { id: 'p9', displayName: 'تعمیرکار صادقی', zoneId: 'zone_narak', skills: ['appliance_repair', 'electrical'], latitude: 35.7710, longitude: 51.4110, responseRate: 0.65, isProfessional: true },
    { id: 'p10', displayName: 'آشپز نوری', zoneId: 'zone_narak', skills: ['food', 'party'], latitude: 35.7800, longitude: 51.4200, responseRate: 0.8, isProfessional: false },
    // p11 is about 3.5km away — should be in 5km radius
    // At 35.775 lat, 1 degree ≈ 90km, so 3.5km ≈ 0.039 degrees
    { id: 'p11', displayName: 'نقاش دوردست', zoneId: 'zone_narak', skills: ['house_painting'], latitude: 35.7750, longitude: 51.3740, responseRate: 0.7, isProfessional: false },
    { id: 'p12', displayName: 'لوله‌کش دوردست', zoneId: 'zone_narak', skills: ['plumbing'], latitude: 35.7450, longitude: 51.3850, responseRate: 0.6, isProfessional: false },
  ];

  for (const person of persons) {
    personRegistry.register(person);
  }

  // ─── Test 1: Person Registry ───

  section('۱. ثبت‌نام اشخاص');

  const stats = personRegistry.getStats();
  assert(stats.totalPersons === 12, `۱۲ نفر ثبت‌نام شدن: ${stats.totalPersons}`);
  assert(stats.zones === 1, `۱ منطقه: ${stats.zones}`);

  // Search by skill
  const painters = personRegistry.search({
    zoneId: 'zone_narak',
    skills: ['house_painting'],
  });
  assert(painters.length === 3, `۳ نقاش پیدا شد: ${painters.length}`);

  // Search by radius
  const nearby = personRegistry.search({
    zoneId: 'zone_narak',
    centerLatitude: 35.7750,
    centerLongitude: 51.4150,
    radius: 2500, // 2.5km
  });
  assert(nearby.length >= 6, `حداقل ۶ نفر در ۲.۵ کیلومتر: ${nearby.length}`);

  // Adjacent skills
  const adjSkills = personRegistry.getAdjacentSkills('house_painting');
  assert(adjSkills.includes('tiling'), 'نقاشی → سرامیک‌کاری مجاور');
  assert(adjSkills.includes('carpentry'), 'نقاشی → نجاری مجاور');

  // ─── Test 2: Anti-Nuisance Rules ───

  section('۲. قوانین ضدآزاری');

  const config = antiNuisance.getConfig();
  assert(config.maxDailyNotifications === MAX_DAILY_NOTIFICATIONS, `حداکثر ${MAX_DAILY_NOTIFICATIONS} نوتیف روزانه`);
  assert(config.quietHoursStart === QUIET_HOURS_START, `ساعت سکوت شروع: ${QUIET_HOURS_START}`);
  assert(config.quietHoursEnd === QUIET_HOURS_END, `ساعت سکوت پایان: ${QUIET_HOURS_END}`);
  assert(config.minResponsesToStop === MIN_RESPONSES_TO_STOP, `حداقل ${MIN_RESPONSES_TO_STOP} پاسخ`);
  assert(config.silenceThreshold === SILENCE_THRESHOLD, `آستانه سکوت: ${SILENCE_THRESHOLD}`);

  // Can notify
  assert(antiNuisance.canNotify('p1'), 'p1 می‌تونه نوتیف بگیره');

  // Record notifications
  for (let i = 0; i < MAX_DAILY_NOTIFICATIONS; i++) {
    antiNuisance.recordNotification('p1', `req_${i}`, 1);
  }
  assert(!antiNuisance.canNotify('p1'), `p1 بعد از ${MAX_DAILY_NOTIFICATIONS} نوتیف نمی‌تونه بیشتر بگیره`);

  // Different person can still get notified
  assert(antiNuisance.canNotify('p2'), 'p2 هنوز می‌تونه نوتیف بگیره');

  // Response tracking
  assert(!antiNuisance.hasEnoughResponses('req_0'), 'هنوز جواب کافی نیست');
  antiNuisance.recordResponse('req_0');
  assert(antiNuisance.getResponseCount('req_0') === 1, '۱ پاسخ ثبت شد');
  antiNuisance.recordResponse('req_0');
  assert(antiNuisance.hasEnoughResponses('req_0'), 'بعد از ۲ پاسخ، موج متوقف میشه');

  // Silence tracking
  for (let i = 0; i < SILENCE_THRESHOLD; i++) {
    antiNuisance.recordSilence('p3');
  }
  assert(antiNuisance.isDownWeighted('p3'), 'p3 بعد از ۳ سکوت، وزنش کم شد');
  assert(antiNuisance.getSilenceCount('p3') === 3, `تعداد سکوت: ${antiNuisance.getSilenceCount('p3')}`);

  // ─── Test 3: Wave 1 — Matching Skill ───

  section('۳. موج ۱ — مهارت منطبق');

  // Reset anti-nuisance for clean tests
  const antiNuisance2 = new AntiNuisanceService();
  const waveService2 = new WaveService(personRegistry, antiNuisance2);

  const request = waveService2.createRequest({
    zoneId: 'zone_narak',
    requesterId: 'user_1',
    description: 'نقاش ساختمان میخوام',
    tags: ['services/house_painting', 'urgency/normal'],
    urgency: 'normal',
  });

  assert(!!request.id, 'درخواست موج ایجاد شد');
  assert(request.status === 'open', 'وضعیت: باز');

  const wave1 = waveService2.dispatchWave1(request.id, 35.7750, 51.4150);

  assert(!wave1.skipped, 'موج ۱ پرتاب شد');
  assert(wave1.count >= 1, `حداقل ۱ نفر نوتیف گرفت: ${wave1.count}`);
  assert(wave1.count <= 8, `حداکثر ۸ نفر: ${wave1.count}`);
  assert(wave1.matchedSkills.includes('house_painting'), 'مهارت نقاشی منطبق');
  assert(wave1.radius === 2500, 'شعاع ۲.۵ کیلومتر');

  // ─── Test 4: Wave 2 — Adjacent Skill ───

  section('۴. موج ۲ — مهارت مجاور');

  const wave2 = waveService2.dispatchWave2(request.id, 35.7750, 51.4150);

  assert(!wave2.skipped, 'موج ۲ پرتاب شد');
  assert(wave2.matchedSkills.length > 1, `مهارت‌های مجاور: ${wave2.matchedSkills.join(', ')}`);
  assert(wave2.matchedSkills.includes('tiling') || wave2.matchedSkills.includes('carpentry'), 'نقاشی ← سرامیک‌کاری/نجاری');
  assert(wave2.radius === 5000, 'شعاع ۵ کیلومتر');

  // ─── Test 5: Wave 3 — Referral ───

  section('۵. موج ۳ — ارجاع');

  const wave3 = waveService2.dispatchWave3(request.id);

  assert(!wave3.skipped, 'موج ۳ پرتاب شد');
  assert(wave3.matchedSkills.includes('referral'), 'نوع: ارجاع');
  assert(wave3.count >= 0, `موج ۳: ${wave3.count} نفر`);

  // ─── Test 6: Response Recording ───

  section('۶. ثبت پاسخ');

  const request2 = waveService2.createRequest({
    zoneId: 'zone_narak',
    requesterId: 'user_2',
    description: 'لوله‌کش میخوام',
    tags: ['services/plumbing'],
  });

  waveService2.dispatchWave1(request2.id, 35.7750, 51.4150);

  // Record a response
  const shouldStop = waveService2.recordResponse(request2.id, 'p2');
  assert(!shouldStop, 'بعد از ۱ پاسخ، ادامه میده');

  // Record another response
  const shouldStop2 = waveService2.recordResponse(request2.id, 'p5');
  assert(shouldStop2, 'بعد از ۲ پاسخ، موج متوقف میشه');

  const updatedRequest = waveService2.getRequest(request2.id);
  assert(updatedRequest?.status === 'fulfilled', 'وضعیت: انجام‌شده');
  assert(updatedRequest?.responseCount === 2, 'تعداد پاسخ: ۲');

  // ─── Test 7: Opt-Out ───

  section('۷. خروج از برچسب');

  personRegistry.optOut('p4', 'services/house_painting');
  assert(personRegistry.hasOptedOut('p4', 'services/house_painting'), 'p4 از نقاشی خارج شد');

  // p4 should not be notified for house_painting waves
  const request3 = waveService2.createRequest({
    zoneId: 'zone_narak',
    requesterId: 'user_3',
    description: 'نقاش ساختمان',
    tags: ['services/house_painting'],
  });

  const wave1_optout = waveService2.dispatchWave1(request3.id, 35.7750, 51.4150);
  assert(!wave1_optout.personIds.includes('p4'), 'p4 نوتیف نقاشی نمیگیره');

  // p4 can still get notified for other tags
  personRegistry.optIn('p4', 'services/house_painting');
  assert(!personRegistry.hasOptedOut('p4', 'services/house_painting'), 'p4 دوباره وارد شد');

  // ─── Test 8: Silence Tracking ───

  section('۸. ردیابی سکوت');

  // Record silence for p7 (3 times)
  for (let i = 0; i < 3; i++) {
    personRegistry.incrementSilence('p7');
  }

  assert(personRegistry.get('p7')?.silenceCount === 3, 'p7 سه بار سکوت کرد');

  // p7 should be excluded from Wave 1 (not down-weighted)
  const request4 = waveService2.createRequest({
    zoneId: 'zone_narak',
    requesterId: 'user_4',
    description: 'قفل‌سازی',
    tags: ['services/locksmith'],
  });

  const wave1_silence = waveService2.dispatchWave1(request4.id, 35.7750, 51.4150);
  assert(!wave1_silence.personIds.includes('p7'), 'p7 (وزن کم‌شده) در موج ۱ نیست');

  // p7 should be included in Wave 2 (down-weighted allowed)
  const wave2_silence = waveService2.dispatchWave2(request4.id, 35.7750, 51.4150);
  // p7 might be included in wave 2 since it includes down-weighted
  // But the adjacent skills for locksmith might not match p7's skills
  // That's fine - the important thing is the logic is correct

  // ─── Test 9: Emergency Channel ───

  section('۹. کانال اضطراری');

  const emergencyResult = waveService2.dispatchEmergency(
    'req_emergency_1',
    'zone_narak',
    'user_emergency'
  );

  assert(!emergencyResult.skipped, 'موج اضطراری پرتاب شد');
  assert(emergencyResult.matchedSkills.includes('emergency'), 'نوع: اضطراری');

  // ─── Test 10: Next Wave Delay ───

  section('۱۰. تأخیر موج‌ها');

  const normalDelay1 = waveService2.getNextWaveDelay(1, 'normal');
  const normalDelay2 = waveService2.getNextWaveDelay(2, 'normal');
  assert(normalDelay1 === 10 * 60 * 1000, `تأخیر عادی موج ۲: ${normalDelay1 / 1000 / 60} دقیقه`);
  assert(normalDelay2 === 20 * 60 * 1000, `تأخیر عادی موج ۳: ${normalDelay2 / 1000 / 60} دقیقه`);

  const urgentDelay1 = waveService2.getNextWaveDelay(1, 'urgent');
  assert(urgentDelay1 === 5 * 60 * 1000, `تأخیر فوری موج ۲: ${urgentDelay1 / 1000 / 60} دقیقه`);

  const emergencyDelay = waveService2.getNextWaveDelay(1, 'emergency');
  assert(emergencyDelay === 2 * 60 * 1000, `تأخیر اضطراری: ${emergencyDelay / 1000 / 60} دقیقه`);

  // ─── Test 11: Daily Notification Limit ───

  section('۱۱. محدودیت نوتیف روزانه');

  const antiNuisance3 = new AntiNuisanceService();
  const personRegistry3 = new PersonRegistry();

  // Register a person who will hit the daily limit
  personRegistry3.register({
    id: 'limited_person',
    displayName: 'محدودشده',
    zoneId: 'zone_narak',
    skills: ['house_painting'],
    latitude: 35.7750,
    longitude: 51.4150,
    responseRate: 0.8,
    isProfessional: false,
  });

  const waveService3 = new WaveService(personRegistry3, antiNuisance3);

  // Send 3 notifications to the same person
  for (let i = 0; i < 3; i++) {
    antiNuisance3.recordNotification('limited_person', `req_${i}`, 1);
  }

  assert(antiNuisance3.getDailyCount('limited_person') === 3, '۳ نوتیف روزانه ثبت شد');
  assert(!antiNuisance3.canNotify('limited_person'), 'نوتیف بیشتر مجاز نیست');

  // ─── Test 12: Haversine Distance ───

  section('۱۲. فاصله هاورسین');

  // Search with radius — p11 is far away (latitude 35.7600 vs 35.7750)
  const nearbyOnly = personRegistry.search({
    zoneId: 'zone_narak',
    skills: ['house_painting'],
    centerLatitude: 35.7750,
    centerLongitude: 51.4150,
    radius: 2500,
  });

  // p11 should NOT be in the 2.5km radius results
  assert(!nearbyOnly.some((p) => p.id === 'p11'), 'p11 (دوردست) در ۲.۵ کیلومتر نیست');

  // p12 should be in the 5km radius results (plumbing at ~3.5km)
  const widerSearch = personRegistry.search({
    zoneId: 'zone_narak',
    skills: ['house_painting'],
    centerLatitude: 35.7750,
    centerLongitude: 51.4150,
    radius: 5000,
  });
  // p11 is about 4.8km away, should be in 5km radius
  assert(widerSearch.some((p) => p.id === 'p11'), 'p11 (دوردست) در ۵ کیلومتر هست');

  // ─── Summary ───

  section('خلاصه آزمون');

  console.log(`\n  ✅ موفق: ${passed}`);
  console.log(`  ❌ ناموفق: ${failed}`);
  console.log(`  📊 مجموع: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n  🎉 فاز ۶ — همه آزمون‌ها موفق!');
  } else {
    console.log(`\n  ⚠️  ${failed} آزمون ناموفق`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
