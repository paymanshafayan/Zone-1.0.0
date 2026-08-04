/**
 * Zone — Phase 7 Test Script
 *
 * Tests the number read-back confirmation and comparison system.
 *
 * Run: npx tsx apps/api/src/test-phase7.ts
 */

import { NumberService, NumberStatus, type LockedNumber } from '@zone/assistant';
import type { ExtractedNumber } from '@zone/core';

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
  const numberService = new NumberService();

  // ─── Test 1: Basis Detection ───

  section('۱. تشخیص مبنای قیمت');

  const b1 = numberService.detectBasis('نود هزار تومان متر مربع');
  assert(b1.basis === 'per_square_metre', 'مبنای متر مربع شناسایی شد');
  assert(b1.label === 'متر مربع', 'برچسب: متر مربع');

  const b2 = numberService.detectBasis('پنجصد هزار تومان کل');
  assert(b2.basis === 'total', 'مبنای کل شناسایی شد');

  const b3 = numberService.detectBasis('صد هزار تومان روزانه');
  assert(b3.basis === 'per_day', 'مبنای روزانه شناسایی شد');

  const b4 = numberService.detectBasis('هزار و دویست تومان ساعتی');
  assert(b4.basis === 'per_hour', 'مبنای ساعتی شناسایی شد');

  const b5 = numberService.detectBasis('سی هزار تومان');
  assert(b5.basis === 'per_unit', 'بدون مبنای مشخص → هر واحد');

  // ─── Test 2: Read-back Generation ───

  section('۲. تولید خوانشی');

  const readback1 = numberService.generateReadback({
    raw: 'نود هزار تومان',
    value: 90000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  });
  assert(readback1.includes('نود هزار'), 'خوانشی شامل مقدار');
  assert(readback1.includes('تومان'), 'خوانشی شامل واحد');
  assert(readback1.includes('متر مربع'), 'خوانشی شامل مبنای متر مربع');
  assert(readback1.includes('درسته'), 'خوانشی شامل سؤال تأیید');

  const readback2 = numberService.generateReadback({
    raw: 'پنجصد هزار',
    value: 500000,
    unit: 'toman',
    basis: 'total',
    isConfirmed: false,
  });
  assert(readback2.includes('پانصد هزار'), 'خوانشی: پانصد هزار');
  assert(readback2.includes('کل'), 'خوانشی شامل «کل»');

  const readback3 = numberService.generateReadback({
    raw: 'هزار و دویست',
    value: 1200,
    unit: 'toman',
    basis: 'per_hour',
    isConfirmed: false,
  });
  assert(readback3.includes('هر ساعت'), 'خوانشی شامل «هر ساعت»');

  // ─── Test 3: Number Lifecycle ───

  section('۳. چرخه حیات عدد');

  // Step 1: Create pending
  const pendingId = numberService.createPending({
    raw: 'نود هزار تومان',
    value: 90000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  }, 'req_1');

  const stats1 = numberService.getStats();
  assert(stats1.pendingConfirmations === 1, 'یک عدد در انتظار تأیید');

  // Step 2: Generate read-back
  const readback = numberService.generateReadback({
    raw: 'نود هزار تومان',
    value: 90000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  });
  assert(readback.includes('درسته'), 'خوانشی تولید شد');

  // Step 3: Confirm and lock
  const locked = numberService.confirmNumber(
    pendingId,
    'provider_rezaei',
    'آقای رضایی',
    'req_1',
    '3 روز'
  );

  assert(locked.status === NumberStatus.LOCKED, 'عدد قفل شد');
  assert(locked.value === 90000, 'مقدار: ۹۰۰۰۰');
  assert(locked.unit === 'toman', 'واحد: تومان');
  assert(locked.basis === 'per_square_metre', 'مبنای: متر مربع');
  assert(locked.providerId === 'provider_rezaei', 'ارائه‌دهنده ثبت شد');
  assert(locked.duration === '3 روز', 'مدت: ۳ روز');
  assert(locked.confidence === 1.0, 'اعتماد: ۱.۰ (تأییدشده)');

  const stats2 = numberService.getStats();
  assert(stats2.pendingConfirmations === 0, 'دیگه عدد در انتظار نیست');
  assert(stats2.totalLocked === 1, 'یک عدد قفل‌شده');

  // ─── Test 4: Number Rejection ───

  section('۴. رد عدد');

  const pendingId2 = numberService.createPending({
    raw: 'دویست هزار',
    value: 200000,
    unit: 'toman',
    basis: 'total',
    isConfirmed: false,
  }, 'req_2');

  const rejected = numberService.rejectNumber(pendingId2);
  assert(rejected, 'عدد رد شد');

  const stats3 = numberService.getStats();
  assert(stats3.pendingConfirmations === 0, 'بعد از رد، عدد در انتظار نیست');

  // ─── Test 5: Multiple Offers + Comparison ───

  section('۵. مقایسه پیشنهادات');

  // Add 3 offers for the same request
  const offers = [
    { providerId: 'p1', providerName: 'آقای رضایی', value: 90000, unit: 'toman', basis: 'per_square_metre', duration: '3 روز' },
    { providerId: 'p2', providerName: 'استاد حسینی', value: 75000, unit: 'toman', basis: 'per_square_metre', duration: '5 روز' },
    { providerId: 'p3', providerName: 'آقای محمدی', value: 100000, unit: 'toman', basis: 'per_square_metre', duration: '2 روز' },
  ];

  for (const offer of offers) {
    const pid = numberService.createPending({
      raw: `${offer.value} ${offer.unit}`,
      value: offer.value,
      unit: offer.unit,
      basis: offer.basis,
      isConfirmed: false,
    }, 'req_compare');

    numberService.confirmNumber(
      pid,
      offer.providerId,
      offer.providerName,
      'req_compare',
      offer.duration
    );
  }

  const compareResult = numberService.compare('req_compare');

  assert(compareResult.totalOffers === 3, `۳ پیشنهاد: ${compareResult.totalOffers}`);
  assert(compareResult.comparisons.length >= 2, `حداقل ۲ محور مقایسه: ${compareResult.comparisons.length}`);

  // Find cheapest
  const cheapest = compareResult.comparisons.find((c) => c.axis === 'cheapest');
  assert(!!cheapest, 'محور ارزان‌ترین وجود داره');
  assert(cheapest!.winner.providerId === 'p2', `ارزان‌ترین: استاد حسینی (${cheapest!.winner.providerName})`);
  assert(cheapest!.voiceText.includes('ارزان‌ترین'), 'متن صوتی شامل «ارزان‌ترین»');

  // Find fastest
  const fastest = compareResult.comparisons.find((c) => c.axis === 'fastest');
  assert(!!fastest, 'محور سریع‌ترین وجود داره');
  assert(fastest!.winner.providerId === 'p3', `سریع‌ترین: آقای محمدی (${fastest!.winner.providerName})`);

  // Summary
  assert(compareResult.summary.includes('3 نفر جواب دادن'), 'خلاصه شامل تعداد');
  assert(compareResult.summary.includes('ارزان‌ترین'), 'خلاصه شامل ارزان‌ترین');
  assert(compareResult.summary.includes('سریع‌ترین'), 'خلاصه شامل سریع‌ترین');

  // ─── Test 6: Most Trusted Axis ───

  section('۶. محور معتمدترین');

  const trustScores = new Map<string, number>();
  trustScores.set('p1', 5);  // 5 recommendations
  trustScores.set('p2', 2);  // 2 recommendations
  trustScores.set('p3', 8);  // 8 recommendations

  const compareWithTrust = numberService.compare('req_compare', trustScores);

  const mostTrusted = compareWithTrust.comparisons.find((c) => c.axis === 'most_trusted');
  assert(!!mostTrusted, 'محور معتمدترین وجود داره');
  assert(mostTrusted!.winner.providerId === 'p3', `معتمدترین: آقای محمدی (۸ معرفی)`);
  assert(mostTrusted!.voiceText.includes('معتمدترین'), 'متن صوتی شامل «معتمدترین»');

  // ─── Test 7: Full Read-back Flow ───

  section('۷. جریان کامل تأیید خوانشی');

  // User says: "یه نقاش میخوام برای آپارتمانم که ۸۰ متره، نود هزار تومان متر مربع"
  const extracted: ExtractedNumber = {
    raw: 'نود هزار تومان متر مربع',
    value: 90000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  };

  // Step 1: Create pending
  const flowId = numberService.createPending(extracted, 'req_flow');

  // Step 2: Generate read-back
  const flowReadback = numberService.generateReadback(extracted);
  assert(flowReadback === 'یعنی نود هزار تومان متر مربع، درسته؟',
    `خوانشی دقیق: "${flowReadback}"`);

  // Step 3: User says "no" → reject
  const rejected2 = numberService.rejectNumber(flowId);
  assert(rejected2, 'عدد رد شد (کاربر گفت نه)');

  // Step 4: User says "نود و پنج هزار" → new number
  const corrected: ExtractedNumber = {
    raw: 'نود و پنج هزار تومان',
    value: 95000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  };

  const correctedId = numberService.createPending(corrected, 'req_flow');
  const correctedReadback = numberService.generateReadback(corrected);
  assert(correctedReadback.includes('95 هزار') || correctedReadback.includes('نود و پنج'), 'خوانشی عدد تصحیح‌شده');

  // Step 5: User says "yes" → confirm and lock
  const confirmedNumber = numberService.confirmNumber(
    correctedId,
    'provider_rezaei',
    'آقای رضایی',
    'req_flow',
    '3 روز'
  );

  assert(confirmedNumber.value === 95000, 'مقدار تأییدشده: ۹۵۰۰۰');
  assert(confirmedNumber.status === NumberStatus.LOCKED, 'وضعیت: قفل‌شده');

  // ─── Test 8: Single Offer Comparison ───

  section('۸. مقایسه با یک پیشنهاد');

  const singleId = numberService.createPending({
    raw: 'صد هزار تومان',
    value: 100000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  }, 'req_single');

  numberService.confirmNumber(singleId, 'p_solo', 'استاد تنهایی', 'req_single', '4 روز');

  const singleCompare = numberService.compare('req_single');
  assert(singleCompare.totalOffers === 1, 'یک پیشنهاد');
  assert(singleCompare.summary.includes('یک نفر جواب داد'), 'خلاصه: یک نفر');

  // ─── Test 9: No Offers ───

  section('۹. بدون پیشنهاد');

  const emptyCompare = numberService.compare('req_empty');
  assert(emptyCompare.totalOffers === 0, 'صفر پیشنهاد');
  assert(emptyCompare.comparisons.length === 0, 'صفر محور مقایسه');
  assert(emptyCompare.summary.includes('هنوز پیشنهادی'), 'خلاصه: بدون پیشنهاد');

  // ─── Test 10: Different Basis Comparison ───

  section('۱۰. مقایسه با مبانی مختلف');

  // One offer per square metre, one total
  const mixed1 = numberService.createPending({
    raw: 'نود هزار متر مربع',
    value: 90000,
    unit: 'toman',
    basis: 'per_square_metre',
    isConfirmed: false,
  }, 'req_mixed');

  numberService.confirmNumber(mixed1, 'pm1', 'آقای الف', 'req_mixed', '3 روز');

  const mixed2 = numberService.createPending({
    raw: 'هفت میلیون کل',
    value: 7000000,
    unit: 'toman',
    basis: 'total',
    isConfirmed: false,
  }, 'req_mixed');

  numberService.confirmNumber(mixed2, 'pm2', 'آقای ب', 'req_mixed', '5 روز');

  const mixedCompare = numberService.compare('req_mixed');
  assert(mixedCompare.totalOffers === 2, '۲ پیشنهاد با مبانی مختلف');
  assert(mixedCompare.comparisons.length >= 2, 'حداقل ۲ محور');

  // ─── Summary ───

  section('خلاصه آزمون');

  console.log(`\n  ✅ موفق: ${passed}`);
  console.log(`  ❌ ناموفق: ${failed}`);
  console.log(`  📊 مجموع: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n  🎉 فاز ۷ — همه آزمون‌ها موفق!');
  } else {
    console.log(`\n  ⚠️  ${failed} آزمون ناموفق`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
