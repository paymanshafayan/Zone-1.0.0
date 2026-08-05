/**
 * Zone — Phase 5 Test Script
 *
 * Tests the three response modes (KNOW/ASK/UNKNOWN) and
 * professional post service.
 *
 * Run: npx tsx apps/api/src/test-phase5.ts
 */

import {
  ResponseModeEngine,
  ToolExecutor,
  MemoryService,
  PostService,
  ASSISTANT_TOOLS,
  ZONE_PERSONA,
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
  // ─── Initialize Services ───

  const memoryService = new MemoryService();
  const postService = new PostService();

  const toolExecutor = new ToolExecutor({
    memoryService,
    postService,
    waveService: null,
  });

  const responseModeEngine = new ResponseModeEngine(toolExecutor, memoryService, postService);

  // ─── Test 1: Tool Definitions ───

  section('۱. تعریف ابزارها');

  const toolNames = Object.keys(ASSISTANT_TOOLS);
  assert(toolNames.length === 4, `چهار ابزار تعریف شده: ${toolNames.join(', ')}`);
  assert(toolNames.includes('search_memories'), 'ابزار search_memories وجود داره');
  assert(toolNames.includes('open_wave'), 'ابزار open_wave وجود داره');
  assert(toolNames.includes('admit_unknown'), 'ابزار admit_unknown وجود داره');

  const toolDefs = toolExecutor.getToolDefinitions();
  assert(toolDefs.length === 4, `چهار تعریف ابزار از اجراکننده: ${toolDefs.length}`);

  // ─── Test 2: Memory Service ───

  section('۲. سرویس حافظه');

  const memory1 = await memoryService.record({
    zoneId: 'zone_narak',
    personId: 'person_rezaei',
    personName: 'آقای رضایی',
    skill: 'house_painting',
    description: 'نقاشی ساختمان آپارتمان ۸۰ متری',
    outcome: 'positive',
    sourcePersonId: 'person_ahmadi',
    sourcePersonName: 'خانم احمدی',
  });

  assert(!!memory1.id, 'حافظه ایجاد شد');
  assert(memory1.confidence === 0.5, 'اعتماد اولیه ۰.۵');
  assert(memory1.skill === 'house_painting', 'مهارت ثبت شد');

  const memory2 = await memoryService.record({
    zoneId: 'zone_narak',
    personId: 'person_rezaei',
    personName: 'آقای رضایی',
    skill: 'house_painting',
    description: 'نقاشی خانه خانم محمدی',
    outcome: 'positive',
    sourcePersonId: 'person_mohammadi',
    sourcePersonName: 'خانم محمدی',
  });

  assert(memory2.id !== memory1.id, 'حافظه منبع دوم جداگانه ثبت شد');

  // Search for all memories about person_rezaei
  const searchResults = await memoryService.search({
    skill: 'house_painting',
    zoneId: 'zone_narak',
    minConfidence: 0.3,
  });

  assert(searchResults.length > 0, `جستجو نتایج داره: ${searchResults.length}`);
  assert(searchResults[0].personName === 'آقای رضایی', 'نتیجه اول آقای رضایی');

  const stats = memoryService.getStats('zone_narak');
  assert(stats.totalMemories > 0, `آمار حافظه: ${stats.totalMemories}`);

  // ─── Test 3: Post Service ───

  section('۳. سرویس پست حرفه‌ای');

  const post1 = await postService.create({
    zoneId: 'zone_narak',
    providerId: 'person_rezaei',
    providerName: 'آقای رضایی',
    media: [
      {
        type: 'image',
        url: 'https://example.com/painting1.jpg',
        thumbnailUrl: 'https://example.com/painting1_thumb.jpg',
      },
      {
        type: 'video',
        url: 'https://example.com/painting1.mp4',
        duration: 10,
      },
    ],
    description: 'نقاشی ساختمان حرفه‌ای — ۲۰ سال تجربه',
    tags: ['services/house_painting', 'urgency/normal'],
  });

  assert(!!post1.id, 'پست حرفه‌ای ایجاد شد');
  assert(post1.media.length === 2, 'دو مدیا ثبت شد');
  assert(post1.isActive, 'پست فعال');
  assert(post1.tags.includes('services/house_painting'), 'برچسب صحیح');

  const post2 = await postService.create({
    zoneId: 'zone_narak',
    providerId: 'person_hosseini',
    providerName: 'استاد حسینی',
    media: [
      {
        type: 'image',
        url: 'https://example.com/painting2.jpg',
      },
    ],
    description: 'نقاشی داخلی و خارجی',
    tags: ['services/house_painting'],
  });

  const feed = await postService.getFeed({
    zoneId: 'zone_narak',
    tags: ['services/house_painting'],
    page: 1,
    pageSize: 20,
  });

  assert(feed.posts.length === 2, `فید دو پست داره: ${feed.posts.length}`);
  assert(feed.total === 2, `مجموع: ${feed.total}`);

  const postCount = await postService.getPostCount('zone_narak', ['services/house_painting']);
  assert(postCount === 2, `تعداد پست حرفه‌ای: ${postCount}`);

  await postService.deactivate(post2.id);
  const activeCount = await postService.getPostCount('zone_narak', ['services/house_painting']);
  assert(activeCount === 1, `بعد از غیرفعال‌سازی: ${activeCount}`);

  await postService.reactivate(post2.id);
  const reactivatedCount = await postService.getPostCount('zone_narak', ['services/house_painting']);
  assert(reactivatedCount === 2, `بعد از فعال‌سازی مجدد: ${reactivatedCount}`);

  // Validate video duration
  try {
    await postService.create({
      zoneId: 'zone_narak',
      providerId: 'person_rezaei',
      providerName: 'آقای رضایی',
      media: [
        {
          type: 'video',
          url: 'https://example.com/long.mp4',
          duration: 30,
        },
      ],
      description: 'ویدیوی طولانی',
      tags: ['services/house_painting'],
    });
    assert(false, 'ویدیوی بیش از ۱۵ ثانیه باید رد بشه');
  } catch (err: any) {
    assert(err.message.includes('15'), 'ویدیوی بیش از ۱۵ ثانیه رد شد');
  }

  // ─── Test 4: Response Mode Engine — KNOW ───

  section('۴. حالت پاسخ — می‌دونم');

  await memoryService.record({
    zoneId: 'zone_test',
    personId: 'person_1',
    personName: 'آقای Test',
    skill: 'plumbing',
    description: 'لوله‌کشی عالی',
    outcome: 'positive',
    sourcePersonId: 'person_2',
    sourcePersonName: 'خانم Test',
  });

  await memoryService.record({
    zoneId: 'zone_test',
    personId: 'person_3',
    personName: 'استاد Test2',
    skill: 'plumbing',
    description: 'لوله‌کشی خوب',
    outcome: 'positive',
    sourcePersonId: 'person_4',
    sourcePersonName: 'آقای Test3',
  });

  const knowResult = await responseModeEngine.decide(
    {
      tags: ['services/plumbing', 'urgency/normal'],
      intent: 'ask',
      numbers: [],
      confidence: 0.8,
    },
    'zone_test',
    'user_test'
  );

  assert(knowResult.mode === 'know', `حالت می‌دونم: ${knowResult.mode}`);
  assert(knowResult.responseText.includes('معرفی'), `پاسخ معرفی داره: "${knowResult.responseText}"`);
  assert(knowResult.decision.toolName === 'search_memories', 'ابزار search_memories استفاده شد');

  // ─── Test 5: Response Mode Engine — ASK ───

  section('۵. حالت پاسخ — می‌پرسم');

  const askResult = await responseModeEngine.decide(
    {
      tags: ['services/electrical', 'urgency/normal'],
      intent: 'ask',
      numbers: [],
      confidence: 0.6,
    },
    'zone_empty',
    'user_test'
  );

  assert(askResult.mode === 'ask', `حالت می‌پرسم: ${askResult.mode}`);
  assert(askResult.responseText.includes('بپرسم'), `پاسخ سؤال داره: "${askResult.responseText}"`);
  assert(askResult.decision.toolName === 'open_wave', 'ابزار open_wave استفاده شد');

  // ─── Test 6: Response Mode Engine — UNKNOWN ───

  section('۶. حالت پاسخ — نمی‌دونم');

  const unknownResult = await responseModeEngine.decide(
    {
      tags: ['services/rocket_science'],
      intent: 'unknown',
      numbers: [],
      confidence: 0.2,
    },
    'zone_empty',
    'user_test'
  );

  assert(unknownResult.mode === 'unknown', `حالت نمی‌دونم: ${unknownResult.mode}`);
  assert(unknownResult.responseText.includes('پیدا نکردم'), `پاسخ صادقانه: "${unknownResult.responseText}"`);
  assert(unknownResult.decision.toolName === 'admit_unknown', 'ابزار admit_unknown استفاده شد');

  // ─── Test 7: Professional Post Announcement ───

  section('۷. اعلام پست حرفه‌ای');

  await postService.create({
    zoneId: 'zone_announce',
    providerId: 'provider_1',
    providerName: 'استاد نقاش',
    media: [{ type: 'image', url: 'https://example.com/1.jpg' }],
    description: 'نقاشی حرفه‌ای',
    tags: ['services/house_painting'],
  });

  await postService.create({
    zoneId: 'zone_announce',
    providerId: 'provider_2',
    providerName: 'نقاشی مهدی',
    media: [{ type: 'image', url: 'https://example.com/2.jpg' }],
    description: 'نقاشی ساختمان',
    tags: ['services/house_painting'],
  });

  const announceResult = await responseModeEngine.decide(
    {
      tags: ['services/house_painting'],
      intent: 'ask',
      numbers: [],
      confidence: 0.6,
    },
    'zone_announce',
    'user_test'
  );

  assert(announceResult.professionalPostCount === 2, `تعداد پست حرفه‌ای: ${announceResult.professionalPostCount}`);

  // ─── Test 8: Persona ───

  section('۸. پرسونا');

  assert(ZONE_PERSONA.includes('رفیق'), 'پرسونا شامل «رفیق»');
  assert(ZONE_PERSONA.includes('نمی‌دونم'), 'پرسونا شامل «نمی‌دونم»');
  assert(ZONE_PERSONA.includes('اختراع نکن'), 'پرسونا شامل «اختراع نکن»');
  assert(ZONE_PERSONA.includes('تبلیغ نکن'), 'پرسونا شامل «تبلیغ نکن»');
  assert(ZONE_PERSONA.includes('توصیف نکن'), 'پرسونا شامل «توصیف نکن»');

  // ─── Test 9: Urgency Handling ───

  section('۹. مدیریت فوریت');

  const urgentResult = await responseModeEngine.decide(
    {
      tags: ['services/plumbing', 'urgency/urgent'],
      intent: 'ask',
      numbers: [],
      confidence: 0.7,
    },
    'zone_empty',
    'user_test'
  );

  assert(urgentResult.mode === 'ask', `حالت فوری: ${urgentResult.mode}`);
  assert(urgentResult.decision.toolArguments.urgency === 'urgent', 'فوریت ثبت شد');

  // ─── Summary ───

  section('خلاصه آزمون');

  console.log(`\n  ✅ موفق: ${passed}`);
  console.log(`  ❌ ناموفق: ${failed}`);
  console.log(`  📊 مجموع: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n  🎉 فاز ۵ — همه آزمون‌ها موفق!');
  } else {
    console.log(`\n  ⚠️  ${failed} آزمون ناموفق`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
