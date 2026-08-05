/**
 * Zone — Phase 8 Test Script
 *
 * Tests the learning loop: memory demand, record_memory tool,
 * enhanced confidence scoring, and the full learning cycle.
 *
 * Run: npx tsx apps/api/src/test-phase8.ts
 */

import {
  LearningService,
  MemoryDemandService,
  MemoryService,
  ToolExecutor,
  type LearnFromUserParams,
  type MemoryDemand,
  type ConfidenceFactors,
  CONFIDENCE_WEIGHTS,
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
  const memoryService = new MemoryService();
  const demandService = new MemoryDemandService();
  const learningService = new LearningService(memoryService, demandService);

  // ─── Test 1: Memory Demand Creation ───

  section('۱. ایجاد تقاضای حافظه');

  const demand1 = demandService.create({
    zoneId: 'zone_vanak',
    skill: 'house_painting',
    requesterId: 'user_ali',
    tags: ['services/house_painting'],
    reason: 'no memories found',
  });

  assert(demand1.id.startsWith('demand_'), 'شناسه تقاضا با demand_ شروع میشه');
  assert(demand1.status === 'open', 'وضعیت: باز');
  assert(demand1.skill === 'house_painting', 'مهارت: نقاشی ساختمان');
  assert(demand1.zoneId === 'zone_vanak', 'محله: ونک');
  assert(demand1.requesterId === 'user_ali', 'درخواست‌کننده: علی');

  // ─── Test 2: Demand TTL ───

  section('۲. عمر تقاضا');

  const demand2 = demandService.create({
    zoneId: 'zone_vanak',
    skill: 'plumbing',
    requesterId: 'user_ali',
    tags: ['services/plumbing'],
    reason: 'skill not in neighbourhood',
    ttl: 3 * 24 * 60 * 60 * 1000, // 3 days
  });

  assert(demand2.ttl === 3 * 24 * 60 * 60 * 1000, 'عمر سفارشی: ۳ روز');

  const demand3 = demandService.create({
    zoneId: 'zone_vanak',
    skill: 'electrical',
    requesterId: 'user_ali',
    tags: ['services/electrical'],
    reason: 'no memories',
  });

  assert(demand3.ttl === 7 * 24 * 60 * 60 * 1000, 'عمر پیش‌فرض: ۷ روز');

  // ─── Test 3: Find Open Demands ───

  section('۳. جستجوی تقاضاهای باز');

  const openDemands = demandService.findOpenDemands('house_painting', 'zone_vanak');
  assert(openDemands.length === 1, `یک تقاضای باز برای نقاشی: ${openDemands.length}`);
  assert(openDemands[0].id === demand1.id, 'همون تقاضای اول');

  const noDemands = demandService.findOpenDemands('carpentry', 'zone_vanak');
  assert(noDemands.length === 0, 'بدون تقاضا برای نجاری');

  // ─── Test 4: Fulfill Demand ───

  section('۴. برآورده کردن تقاضا');

  const fulfilled = demandService.fulfill({
    demandId: demand1.id,
    personId: 'person_rezaei',
    personName: 'آقای رضایی',
    description: 'نقاشی آپارتمان ۸۰ متری، خیلی خوب کار کرد',
    outcome: 'positive',
    reportedBy: 'user_ali',
  });

  assert(!!fulfilled, 'تقاضا برآورده شد');
  assert(fulfilled!.status === 'fulfilled', 'وضعیت: برآورده‌شده');
  assert(fulfilled!.fulfilledAt !== undefined, 'تاریخ برآورده‌شدن ثبت شد');
  assert(fulfilled!.reportedBy === 'user_ali', 'گزارش‌دهنده: علی');

  // ─── Test 5: Demand Already Fulfilled ───

  section('۵. تقاضای تکراری');

  const fulfilledAgain = demandService.fulfill({
    demandId: demand1.id,
    personId: 'person_other',
    personName: 'شخص دیگر',
    description: 'تست',
    outcome: 'neutral',
  });

  assert(fulfilledAgain === null, 'تقاضای برآورده‌شده دوباره برآورده نمیشه');

  // ─── Test 6: Cancel Demand ───

  section('۶. لغو تقاضا');

  const demand4 = demandService.create({
    zoneId: 'zone_vanak',
    skill: 'cleaning',
    requesterId: 'user_ali',
    tags: ['services/cleaning'],
    reason: 'test',
  });

  const cancelled = demandService.cancel(demand4.id);
  assert(cancelled, 'تقاضا لغو شد');

  const cancelledDemand = demandService.get(demand4.id);
  assert(cancelledDemand!.status === 'cancelled', 'وضعیت: لغو‌شده');

  // ─── Test 7: Demand Statistics ───

  section('۷. آمار تقاضاها');

  const stats = demandService.getStats();
  assert(stats.total >= 4, `مجموع: ${stats.total} ≥ ۴`);
  assert(stats.fulfilled >= 1, `برآورده‌شده: ${stats.fulfilled} ≥ ۱`);
  assert(stats.open >= 1, `باز: ${stats.open} ≥ ۱`);
  assert(stats.cancelled >= 1, `لغو‌شده: ${stats.cancelled} ≥ ۱`);

  // ─── Test 8: Full Learning Loop ───

  section('۸. حلقه کامل یادگیری');

  // Step 1: User asks for a locksmith → UNKNOWN mode
  const learningDemand = learningService.createDemand({
    zoneId: 'zone_narak',
    skill: 'locksmith',
    requesterId: 'user_sara',
    tags: ['services/locksmith'],
    reason: 'no memories in neighbourhood',
  });

  assert(learningDemand.status === 'open', 'گام ۱: تقاضای یادگیری ایجاد شد');

  // Step 2: User comes back and reports finding someone
  const learnResult = await learningService.learnFromUser({
    zoneId: 'zone_narak',
    personId: 'person_mohammadi',
    personName: 'آقای محمدی',
    skill: 'locksmith',
    description: 'قفل در رو عوض کرد، خیلی سریع و تمیز',
    outcome: 'positive',
    sourcePersonId: 'user_sara',
    sourcePersonName: 'سارا',
    demandId: learningDemand.id,
  });

  assert(learnResult.memory.id.startsWith('mem_'), 'گام ۲: حافظه ثبت شد');
  assert(learnResult.fulfilledDemand !== undefined, 'گام ۲: تقاضا برآورده شد');
  assert(learnResult.fulfilledDemand!.status === 'fulfilled', 'وضعیت تقاضا: برآورده‌شده');
  assert(learnResult.timeToLearn !== undefined, 'زمان یادگیری ثبت شد');
  assert(learnResult.responseText.includes('یادداشت کردم'), 'متن پاسخ: یادداشت کردم');
  assert(learnResult.responseText.includes('آقای محمدی'), 'متن پاسخ شامل نام شخص');
  assert(learnResult.responseText.includes('دفعه بعد از اول می‌شناسم'), 'متن پاسخ: دفعه بعد از اول می‌شناسم');

  // Step 3: Now search for locksmith → should find the memory
  const searchResult = await learningService.searchWithContext({
    skill: 'locksmith',
    zoneId: 'zone_narak',
    minConfidence: 0.1,
  });

  assert(searchResult.memories.length >= 1, 'گام ۳: حافظه پیدا شد');
  assert(searchResult.openDemands.length === 0, 'گام ۳: تقاضای باز نیست');

  // ─── Test 9: Auto-matching Demand ───

  section('۹. تطبیق خودکار تقاضا');

  // User asks for plumber → UNKNOWN
  const plumberDemand = learningService.createDemand({
    zoneId: 'zone_narak',
    skill: 'plumbing',
    requesterId: 'user_sara',
    tags: ['services/plumbing'],
    reason: 'no plumber in neighbourhood',
  });

  // User reports back WITHOUT specifying demandId
  // The system should auto-match to the open demand
  const autoMatchResult = await learningService.learnFromUser({
    zoneId: 'zone_narak',
    personId: 'person_hosseini',
    personName: 'استاد حسینی',
    skill: 'plumbing',
    description: 'لوله‌کشی حمام رو درست کرد',
    outcome: 'positive',
    sourcePersonId: 'user_sara',
    sourcePersonName: 'سارا',
    // No demandId! System should auto-match
  });

  assert(autoMatchResult.fulfilledDemand !== undefined, 'تقاضا خودکار برآورده شد');
  assert(autoMatchResult.fulfilledDemand!.id === plumberDemand.id, 'همون تقاضای لوله‌کشی');

  // ─── Test 10: Enhanced Confidence Scoring ───

  section('۱۰. امتیاز اعتماد پیشرفته');

  // Record a single memory → base confidence
  const singleResult = await learningService.learnFromUser({
    zoneId: 'zone_test',
    personId: 'person_test1',
    personName: 'استاد تست',
    skill: 'tiling',
    description: 'سرامیک‌کاری خوبی بود',
    outcome: 'positive',
    sourcePersonId: 'user_test1',
    sourcePersonName: 'کاربر تست',
  });

  assert(singleResult.confidence >= CONFIDENCE_WEIGHTS.BASE, `اعتماد پایه: ${singleResult.confidence} ≥ ${CONFIDENCE_WEIGHTS.BASE}`);
  assert(singleResult.confidence <= CONFIDENCE_WEIGHTS.MAX_CONFIDENCE, `اعتماد حداکثر: ${singleResult.confidence} ≤ ${CONFIDENCE_WEIGHTS.MAX_CONFIDENCE}`);

  // Record a memory from learning loop → higher confidence
  const learningLoopDemand = learningService.createDemand({
    zoneId: 'zone_test',
    skill: 'tiling',
    requesterId: 'user_test1',
    tags: ['services/tiling'],
    reason: 'test',
  });

  const learningLoopResult = await learningService.learnFromUser({
    zoneId: 'zone_test',
    personId: 'person_test1',
    personName: 'استاد تست',
    skill: 'tiling',
    description: 'سرامیک‌کاری عالی',
    outcome: 'positive',
    sourcePersonId: 'user_test2',
    sourcePersonName: 'کاربر تست ۲',
    demandId: learningLoopDemand.id,
  });

  // Learning loop should give higher confidence
  assert(learningLoopResult.confidence > CONFIDENCE_WEIGHTS.BASE, `اعتماد حلقه یادگیری: ${learningLoopResult.confidence} > ${CONFIDENCE_WEIGHTS.BASE}`);

  // ─── Test 11: Multiple Sources Increase Confidence ───

  section('۱۱. تنوع منبع → اعتماد بیشتر');

  // Record memory from first source
  const firstSource = await learningService.learnFromUser({
    zoneId: 'zone_multi',
    personId: 'person_multi',
    personName: 'استاد چندمنبعی',
    skill: 'carpentry',
    description: 'نجاری خوب',
    outcome: 'positive',
    sourcePersonId: 'source_1',
    sourcePersonName: 'منبع اول',
  });

  const firstConfidence = firstSource.confidence;

  // Record memory from second source for same person
  const secondSource = await learningService.learnFromUser({
    zoneId: 'zone_multi',
    personId: 'person_multi',
    personName: 'استاد چندمنبعی',
    skill: 'carpentry',
    description: 'نجاری عالی',
    outcome: 'positive',
    sourcePersonId: 'source_2',
    sourcePersonName: 'منبع دوم',
  });

  // Second source should give equal or higher confidence
  // (due to source diversity boost)
  assert(secondSource.confidence >= firstConfidence, `اعتماد دوم: ${secondSource.confidence} ≥ ${firstConfidence}`);

  // ─── Test 12: Tool Executor with record_memory ───

  section('۱۲. ابزار record_memory در ToolExecutor');

  const toolExecutor = new ToolExecutor({
    memoryService,
    learningService,
  });

  // Test record_memory tool
  const recordResult = await toolExecutor.execute({
    name: 'record_memory',
    arguments: {
      zoneId: 'zone_tool_test',
      personId: 'person_tool_test',
      personName: 'آقای ابزاری',
      skill: 'electrical',
      description: 'برقکاری عالی',
      outcome: 'positive',
      sourcePersonId: 'user_tool_test',
      sourcePersonName: 'کاربر ابزار',
    },
  });

  assert(recordResult.success, 'ابزار record_memory موفق');
  assert(recordResult.data.mode === 'record', 'حالت: record');
  assert(recordResult.data.personName === 'آقای ابزاری', 'نام شخص درست');
  assert(recordResult.data.skill === 'electrical', 'مهارت: برقکاری');
  assert(recordResult.data.confidence > 0, 'اعتماد مثبت');

  // ─── Test 13: admit_unknown Creates Demand ───

  section('۱۳. ابزار admit_unknown تقاضا ایجاد می‌کنه');

  const unknownResult = await toolExecutor.execute({
    name: 'admit_unknown',
    arguments: {
      reason: 'no memories found',
      skill: 'house_painting',
      zoneId: 'zone_tool_test',
      tags: ['services/house_painting'],
      requesterId: 'user_tool_test',
    },
  });

  assert(unknownResult.success, 'ابزار admit_unknown موفق');
  assert(unknownResult.data.mode === 'unknown', 'حالت: unknown');
  assert(unknownResult.data.askedForFeedback === true, 'درخواست بازخورد: بله');
  assert(!!unknownResult.data.demandId, `تقاضا ایجاد شد: ${unknownResult.data.demandId}`);

  // ─── Test 14: Tool Definitions Include record_memory ───

  section('۱۴. تعریف ابزارها');

  const toolDefs = toolExecutor.getToolDefinitions();
  const toolNames = toolDefs.map((t) => t.name);

  assert(toolNames.includes('search_memories'), 'ابزار search_memories وجود داره');
  assert(toolNames.includes('open_wave'), 'ابزار open_wave وجود داره');
  assert(toolNames.includes('admit_unknown'), 'ابزار admit_unknown وجود داره');
  assert(toolNames.includes('record_memory'), 'ابزار record_memory وجود داره');

  // ─── Test 15: Learning Statistics ───

  section('۱۵. آمار یادگیری');

  const learningStats = learningService.getStats('zone_narak');

  assert(learningStats.totalMemories >= 0, `مجموع حافظه: ${learningStats.totalMemories}`);
  assert(learningStats.totalDemands >= 0, `مجموع تقاضا: ${learningStats.totalDemands}`);
  assert(learningStats.fulfilledDemands >= 0, `برآورده‌شده: ${learningStats.fulfilledDemands}`);
  assert(learningStats.learningRate >= 0, `نرخ یادگیری: ${learningStats.learningRate}`);
  assert(learningStats.averageTimeToLearn >= 0, `میانگین زمان یادگیری: ${learningStats.averageTimeToLearn}`);

  // ─── Test 16: Demand Search ───

  section('۱۶. جستجوی تقاضا');

  const allDemands = demandService.search({});
  assert(allDemands.length >= 4, `مجموع تقاضاها: ${allDemands.length} ≥ ۴`);

  const aliDemands = demandService.search({ requesterId: 'user_ali' });
  assert(aliDemands.length >= 3, `تقاضاهای علی: ${aliDemands.length} ≥ ۳`);

  const openDemandsSearch = demandService.search({ status: 'open' });
  assert(openDemandsSearch.length >= 1, `تقاضاهای باز: ${openDemandsSearch.length} ≥ ۱`);

  // ─── Test 17: Demand Limit per User ───

  section('۱۷. محدودیت تقاضا برای هر کاربر');

  // Create 10 demands for the same user (should be fine)
  const limitDemands: MemoryDemand[] = [];
  for (let i = 0; i < 10; i++) {
    limitDemands.push(demandService.create({
      zoneId: 'zone_limit',
      skill: `skill_${i}`,
      requesterId: 'user_limit',
      tags: [`services/skill_${i}`],
      reason: 'test',
    }));
  }

  const userLimitDemands = demandService.findDemandsForUser('user_limit');
  assert(userLimitDemands.length <= 11, `تقاضاهای کاربر: ${userLimitDemands.length} ≤ ۱۱`);

  // Create one more — should expire the oldest
  const extraDemand = demandService.create({
    zoneId: 'zone_limit',
    skill: 'skill_extra',
    requesterId: 'user_limit',
    tags: ['services/skill_extra'],
    reason: 'test',
  });

  assert(!!extraDemand, 'تقاضای اضافی ایجاد شد');

  // ─── Test 18: Negative Outcome Memory ───

  section('۱۸. حافظه با نتیجه منفی');

  const negativeDemand = learningService.createDemand({
    zoneId: 'zone_negative',
    skill: 'repair',
    requesterId: 'user_negative',
    tags: ['services/repair'],
    reason: 'test',
  });

  const negativeResult = await learningService.learnFromUser({
    zoneId: 'zone_negative',
    personId: 'person_bad',
    personName: 'استاد بد',
    skill: 'repair',
    description: 'کار بدی کرد',
    outcome: 'negative',
    sourcePersonId: 'user_negative',
    sourcePersonName: 'کاربر منفی',
    demandId: negativeDemand.id,
  });

  assert(negativeResult.memory.outcome === 'negative', 'نتیجه: منفی');
  assert(negativeResult.fulfilledDemand !== undefined, 'تقاضا برآورده شد حتی با نتیجه منفی');
  assert(negativeResult.responseText.includes('تجربه بد') || negativeResult.responseText.includes('متأسفانه'), 'متن پاسخ مناسب نتیجه منفی');

  // ─── Test 19: Temporal Decay in Learning Context ───

  section('۱۹. زوال زمانی در بافت یادگیری');

  // Record a memory
  const decayResult = await learningService.learnFromUser({
    zoneId: 'zone_decay',
    personId: 'person_decay',
    personName: 'استاد زوال',
    skill: 'moving',
    description: 'اسباب‌کشی خوب',
    outcome: 'positive',
    sourcePersonId: 'user_decay',
    sourcePersonName: 'کاربر زوال',
  });

  // Search with context
  const decaySearch = await learningService.searchWithContext({
    skill: 'moving',
    zoneId: 'zone_decay',
    minConfidence: 0.1,
  });

  assert(decaySearch.memories.length >= 1, 'حافظه با زوال زمانی پیدا شد');

  // ─── Test 20: Search Without Learning Service ───

  section('۲۰. جستجو بدون سرویس یادگیری');

  const basicToolExecutor = new ToolExecutor({
    memoryService,
    // No learning service
  });

  const basicRecord = await basicToolExecutor.execute({
    name: 'record_memory',
    arguments: {
      zoneId: 'zone_basic',
      personId: 'person_basic',
      personName: 'استاد پایه',
      skill: 'cleaning',
      description: 'نظافت خوب',
      outcome: 'positive',
      sourcePersonId: 'user_basic',
      sourcePersonName: 'کاربر پایه',
    },
  });

  assert(basicRecord.success, 'ثبت حافظه بدون سرویس یادگیری موفق');
  assert(basicRecord.data.mode === 'record', 'حالت: record');
  assert(basicRecord.data.fulfilledDemand === false, 'تقاضا برآورده نشده (بدون سرویس)');

  // ─── Summary ───

  section('خلاصه آزمون');

  console.log(`\n  ✅ موفق: ${passed}`);
  console.log(`  ❌ ناموفق: ${failed}`);
  console.log(`  📊 مجموع: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n  🎉 فاز ۸ — همه آزمون‌ها موفق!');
  } else {
    console.log(`\n  ⚠️  ${failed} آزمون ناموفق`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
