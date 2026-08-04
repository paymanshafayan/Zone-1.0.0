/**
 * Zone — Phase 9 Test Script
 *
 * Tests the professional subscription + license verification flow.
 *
 * Run: npx tsx apps/api/src/test-phase9.ts
 */

import {
  LicenseVerificationService,
  ProfessionalSubscriptionService,
  SUBSCRIPTION_PLANS,
  PostService,
  type SubmitLicenseParams,
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
  const postService = new PostService();
  const licenseService = new LicenseVerificationService();
  const subscriptionService = new ProfessionalSubscriptionService(licenseService, postService);

  // ─── Test 1: License Number Validation ───

  section('۱. اعتبارسنجی شماره مجوز');

  assert(licenseService.isValidLicenseNumber('12345/م'), 'فرمت اتحادیه: ۱۲۳۴۵/م');
  assert(licenseService.isValidLicenseNumber('12345'), 'فرمت عددی ساده: ۱۲۳۴۵');
  assert(licenseService.isValidLicenseNumber('123-456'), 'فرمت بازه: ۱۲۳-۴۵۶');
  assert(!licenseService.isValidLicenseNumber('abc'), 'فرمت نامعتبر: abc');

  // Persian digits
  assert(licenseService.isValidLicenseNumber('۱۲۳۴۵/م'), 'ارقام فارسی: ۱۲۳۴۵/م');

  // ─── Test 2: Submit License ───

  section('۲. ثبت مجوز حرفه‌ای');

  const license1 = await licenseService.submitLicense({
    personId: 'person_rezaei',
    personName: 'آقای رضایی',
    licenseNumber: '54321/م',
    licenseImageUrl: 'https://cdn.zone.ir/licenses/rezaei.jpg',
    profession: 'house_painting',
    zoneId: 'zone_vanak',
  });

  assert(license1.id.startsWith('license_'), 'شناسه مجوز با license_ شروع میشه');
  assert(license1.personId === 'person_rezaei', 'شخص: آقای رضایی');
  assert(license1.licenseNumber === '54321/م', 'شماره مجوز: ۵۴۳۲۱/م');
  assert(license1.profession === 'house_painting', 'حرفه: نقاشی ساختمان');
  assert(license1.status === 'pending', 'وضعیت: در انتظار');

  // ─── Test 3: Duplicate License Number ───

  section('۳. شماره مجوز تکراری');

  let duplicateError = false;
  try {
    // Try to submit the same license number for a different person
    const licenseService2 = new LicenseVerificationService();
    // First verify the license
    await licenseService2.submitLicense({
      personId: 'person_first',
      personName: 'شخص اول',
      licenseNumber: '99999/م',
      licenseImageUrl: 'https://cdn.zone.ir/license1.jpg',
      profession: 'plumbing',
      zoneId: 'zone_vanak',
    });

    // Verify it
    await licenseService2.verifyLicense({
      licenseId: (await licenseService2.search({ personId: 'person_first' }))[0].id,
      approved: true,
      verifiedBy: 'admin',
    });

    // Try to submit same number for different person
  await licenseService2.submitLicense({
    personId: 'person_second',
    personName: 'شخص دوم',
    licenseNumber: '99999/م',
    licenseImageUrl: 'https://cdn.zone.ir/license2.jpg',
    profession: 'plumbing',
    zoneId: 'zone_vanak',
  });
  } catch (err: any) {
    duplicateError = err.message.includes('شخص دیگری');
  }
  assert(duplicateError, 'شماره مجوز تکراری برای شخص دیگر رد میشه');

  // ─── Test 4: Verify License (Approved) ───

  section('۴. تأیید مجوز');

  const verifiedLicense = await licenseService.verifyLicense({
    licenseId: license1.id,
    approved: true,
    verifiedBy: 'admin_system',
    verificationReference: 'EXT-VERIFY-12345',
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  });

  assert(!!verifiedLicense, 'مجوز تأیید شد');
  assert(verifiedLicense!.status === 'verified', 'وضعیت: تأییدشده');
  assert(verifiedLicense!.verifiedAt !== undefined, 'تاریخ تأیید ثبت شد');
  assert(verifiedLicense!.verifiedBy === 'admin_system', 'تأییدکننده: admin_system');
  assert(verifiedLicense!.verificationReference === 'EXT-VERIFY-12345', 'مرجع استعلام ثبت شد');

  // ─── Test 5: Reject License ───

  section('۵. رد مجوز');

  const rejectedLicense = await licenseService.submitLicense({
    personId: 'person_bad',
    personName: 'شخص نامعتبر',
    licenseNumber: '11111/ص',
    licenseImageUrl: 'https://cdn.zone.ir/bad-license.jpg',
    profession: 'electrical',
    zoneId: 'zone_vanak',
  });

  const rejected = await licenseService.verifyLicense({
    licenseId: rejectedLicense.id,
    approved: false,
    verifiedBy: 'admin_system',
    rejectionReason: 'مجوز در سیستم اتحادیه یافت نشد',
  });

  assert(rejected!.status === 'rejected', 'وضعیت: ردشده');
  assert(rejected!.rejectionReason === 'مجوز در سیستم اتحادیه یافت نشد', 'دلیل رد ثبت شد');

  // ─── Test 6: License Statistics ───

  section('۶. آمار مجوزها');

  const licenseStats = licenseService.getStats();
  assert(licenseStats.total >= 2, `مجموع: ${licenseStats.total} ≥ ۲`);
  assert(licenseStats.verified >= 1, `تأییدشده: ${licenseStats.verified} ≥ ۱`);
  assert(licenseStats.rejected >= 1, `ردشده: ${licenseStats.rejected} ≥ ۱`);
  assert(licenseStats.pending >= 0, `در انتظار: ${licenseStats.pending}`);

  // ─── Test 7: Subscription Plans ───

  section('۷. طرح‌های اشتراک');

  const plans = subscriptionService.getPlans();
  assert(plans.length === 3, `۳ طرح: ${plans.length}`);
  assert(plans[0].id === 'monthly', 'طرح ماهانه');
  assert(plans[0].price === 150000, 'قیمت ماهانه: ۱۵۰ هزار تومان');
  assert(plans[1].id === 'quarterly', 'طرح سه‌ماهه');
  assert(plans[2].id === 'annual', 'طرح سالانه');
  assert(plans[0].features.length > 0, 'ویژگی‌ها تعریف شده');

  // ─── Test 8: Full Registration Flow ───

  section('۸. جریان کامل ثبت‌نام حرفه‌ای');

  // Step 1: Register
  const registration = await subscriptionService.registerProfessional({
    personId: 'person_rezaei',
    personName: 'آقای رضایی',
    zoneId: 'zone_vanak',
    license: {
      personId: 'person_rezaei',
      personName: 'آقای رضایی',
      licenseNumber: '54321/م',
      licenseImageUrl: 'https://cdn.zone.ir/licenses/rezaei.jpg',
      profession: 'house_painting',
      zoneId: 'zone_vanak',
    },
    planId: 'monthly',
  });

  assert(registration.subscription.id.startsWith('sub_'), 'گام ۱: اشتراک ایجاد شد');
  assert(registration.subscription.status === 'pending', 'وضعیت: در انتظار');
  assert(registration.paymentUrl.includes('pay.zone.ir'), 'لینک پرداخت خارجی');
  // License may be 'verified' (from Test 4) or 'pending' (re-submitted)
  assert(['verified', 'pending'].includes(registration.license.status), `وضعیت مجوز: ${registration.license.status}`);

  // Step 2: Activate subscription (after external payment)
  const activated = await subscriptionService.activateSubscription({
    subscriptionId: registration.subscription.id,
    paymentReference: 'PAY-12345-EXT',
  });

  assert(!!activated, 'گام ۲: اشتراک فعال شد');
  assert(activated!.status === 'active', 'وضعیت: فعال');
  assert(activated!.startedAt !== undefined, 'تاریخ شروع ثبت شد');
  assert(activated!.expiresAt !== undefined, 'تاریخ انقضا ثبت شد');
  assert(activated!.paymentReference === 'PAY-12345-EXT', 'مرجع پرداخت ثبت شد');

  // ─── Test 9: Professional Status Check ───

  section('۹. بررسی وضعیت حرفه‌ای');

  const status = subscriptionService.getProfessionalStatus('person_rezaei');
  assert(status.status === 'professional', 'وضعیت: حرفه‌ای');
  assert(status.subscription !== undefined, 'اشتراک فعال وجود داره');
  assert(status.license !== undefined, 'مجوز تأییدشده وجود داره');

  const normalStatus = subscriptionService.getProfessionalStatus('person_normal');
  assert(normalStatus.status === 'normal', 'وضعیت شخص عادی: عادی');

  // ─── Test 10: Subscription Expiry ───

  section('۱۰. انقضای اشتراک');

  // Create a subscription that expires immediately
  const expiredReg = await subscriptionService.registerProfessional({
    personId: 'person_expired',
    personName: 'شخص منقضی',
    zoneId: 'zone_vanak',
    license: {
      personId: 'person_expired',
      personName: 'شخص منقضی',
      licenseNumber: '22222/م',
      licenseImageUrl: 'https://cdn.zone.ir/expired.jpg',
      profession: 'plumbing',
      zoneId: 'zone_vanak',
    },
    planId: 'monthly',
  });

  // Verify the license first
  const expiredLicense = licenseService.get(expiredReg.license.id);
  if (expiredLicense && expiredLicense.status === 'pending') {
    await licenseService.verifyLicense({
      licenseId: expiredLicense.id,
      approved: true,
      verifiedBy: 'admin',
    });
  }

  // Activate
  const expiredSub = await subscriptionService.activateSubscription({
    subscriptionId: expiredReg.subscription.id,
    paymentReference: 'PAY-EXPIRED',
  });

  // Manually set expiration to past
  if (expiredSub) {
    expiredSub.expiresAt = new Date(Date.now() - 1000); // 1 second ago
  }

  // Check expirations
  const expiredIds = await subscriptionService.checkExpirations();
  assert(expiredIds.includes(expiredReg.subscription.id), 'اشتراک منقضی شد');

  // Check status
  const expiredStatus = subscriptionService.getProfessionalStatus('person_expired');
  assert(expiredStatus.status === 'normal', 'بعد از انقضا: عادی');

  // ─── Test 11: Post Deactivation on Expiry ───

  section('۱۱. مخفی شدن پست‌ها بعد از انقضا');

  // Create a post for the expired provider
  const post = await postService.create({
    zoneId: 'zone_vanak',
    providerId: 'person_expired',
    providerName: 'شخص منقضی',
    media: [{ type: 'image', url: 'https://cdn.zone.ir/test.jpg' }],
    description: 'تست پست حرفه‌ای',
    tags: ['services/plumbing'],
  });

  assert(post.isActive, 'پست ابتدا فعال');

  // Create another subscription that will expire
  const postReg = await subscriptionService.registerProfessional({
    personId: 'person_post_test',
    personName: 'تست پست',
    zoneId: 'zone_vanak',
    license: {
      personId: 'person_post_test',
      personName: 'تست پست',
      licenseNumber: '33333/م',
      licenseImageUrl: 'https://cdn.zone.ir/test.jpg',
      profession: 'carpentry',
      zoneId: 'zone_vanak',
    },
    planId: 'monthly',
  });

  // Verify license
  const postLicense = licenseService.get(postReg.license.id);
  if (postLicense && postLicense.status === 'pending') {
    await licenseService.verifyLicense({
      licenseId: postLicense.id,
      approved: true,
      verifiedBy: 'admin',
    });
  }

  // Activate
  const postSub = await subscriptionService.activateSubscription({
    subscriptionId: postReg.subscription.id,
    paymentReference: 'PAY-POST',
  });

  assert(postSub!.status === 'active', 'اشتراک فعال');

  // Create a post for this provider
  const proPost = await postService.create({
    zoneId: 'zone_vanak',
    providerId: 'person_post_test',
    providerName: 'تست پست',
    media: [{ type: 'image', url: 'https://cdn.zone.ir/pro.jpg' }],
    description: 'پست حرفه‌ای تست',
    tags: ['services/carpentry'],
  });

  assert(proPost.isActive, 'پست حرفه‌ای فعال');

  // Expire the subscription
  if (postSub) {
    postSub.expiresAt = new Date(Date.now() - 1000);
  }
  await subscriptionService.checkExpirations();

  // Check post is now inactive
  const inactivePost = await postService.get(proPost.id);
  assert(!inactivePost!.isActive, 'پست بعد از انقضا غیرفعال شد');

  // ─── Test 12: Subscription Renewal ───

  section('۱۲. تمدید اشتراک');

  // Renew the expired subscription
  const renewed = await subscriptionService.renewSubscription(
    postReg.subscription.id,
    'quarterly',
    'PAY-RENEW-123'
  );

  assert(!!renewed, 'اشتراک تمدید شد');
  assert(renewed!.status === 'active', 'وضعیت: فعال');
  assert(renewed!.planId === 'quarterly', 'طرح جدید: سه‌ماهه');

  // Check post is active again
  const reactivatedPost = await postService.get(proPost.id);
  assert(reactivatedPost!.isActive, 'پست بعد از تمدید دوباره فعال شد');

  // ─── Test 13: Subscription Cancellation ───

  section('۱۳. لغو اشتراک');

  const cancelReg = await subscriptionService.registerProfessional({
    personId: 'person_cancel',
    personName: 'شخص لغو',
    zoneId: 'zone_vanak',
    license: {
      personId: 'person_cancel',
      personName: 'شخص لغو',
      licenseNumber: '44444/م',
      licenseImageUrl: 'https://cdn.zone.ir/cancel.jpg',
      profession: 'tiling',
      zoneId: 'zone_vanak',
    },
    planId: 'monthly',
  });

  // Verify + activate
  const cancelLicense = licenseService.get(cancelReg.license.id);
  if (cancelLicense && cancelLicense.status === 'pending') {
    await licenseService.verifyLicense({
      licenseId: cancelLicense.id,
      approved: true,
      verifiedBy: 'admin',
    });
  }

  await subscriptionService.activateSubscription({
    subscriptionId: cancelReg.subscription.id,
    paymentReference: 'PAY-CANCEL',
  });

  // Create a post
  await postService.create({
    zoneId: 'zone_vanak',
    providerId: 'person_cancel',
    providerName: 'شخص لغو',
    media: [{ type: 'image', url: 'https://cdn.zone.ir/cancel-post.jpg' }],
    description: 'پست لغو',
    tags: ['services/tiling'],
  });

  // Cancel the subscription
  const cancelled = await subscriptionService.cancelSubscription(cancelReg.subscription.id);
  assert(cancelled, 'اشتراک لغو شد');

  const cancelStatus = subscriptionService.getProfessionalStatus('person_cancel');
  assert(cancelStatus.status === 'normal', 'بعد از لغو: عادی');

  // ─── Test 14: Already Active Subscription ───

  section('۱۴. اشتراک فعال تکراری');

  let duplicateSubError = false;
  try {
    await subscriptionService.registerProfessional({
      personId: 'person_rezaei', // Already has active subscription
      personName: 'آقای رضایی',
      zoneId: 'zone_vanak',
      license: {
        personId: 'person_rezaei',
        personName: 'آقای رضایی',
        licenseNumber: '54321/م',
        licenseImageUrl: 'https://cdn.zone.ir/rezaei.jpg',
        profession: 'house_painting',
        zoneId: 'zone_vanak',
      },
      planId: 'monthly',
    });
  } catch (err: any) {
    duplicateSubError = err.message.includes('فعال');
  }
  assert(duplicateSubError, 'اشتراک فعال تکراری رد میشه');

  // ─── Test 15: Invalid License Number ───

  section('۱۵. شماره مجوز نامعتبر');

  let invalidLicenseError = false;
  try {
    await licenseService.submitLicense({
      personId: 'person_invalid',
      personName: 'شخص نامعتبر',
      licenseNumber: 'invalid',
      licenseImageUrl: 'https://cdn.zone.ir/invalid.jpg',
      profession: 'house_painting',
      zoneId: 'zone_vanak',
    });
  } catch (err: any) {
    invalidLicenseError = err.message.includes('معتبر نیست');
  }
  assert(invalidLicenseError, 'شماره مجوز نامعتبر رد میشه');

  // ─── Test 16: License Search ───

  section('۱۶. جستجوی مجوزها');

  const vanakLicenses = licenseService.search({ zoneId: 'zone_vanak' });
  assert(vanakLicenses.length >= 3, `مجوزهای ونک: ${vanakLicenses.length} ≥ ۳`);

  const verifiedLicenses = licenseService.search({ status: 'verified' });
  assert(verifiedLicenses.length >= 1, `مجوزهای تأییدشده: ${verifiedLicenses.length} ≥ ۱`);

  const rezaeiLicenses = licenseService.getByPerson('person_rezaei');
  assert(rezaeiLicenses.length >= 1, `مجوزهای رضایی: ${rezaeiLicenses.length} ≥ ۱`);

  const verifiedLicenseCheck = licenseService.getVerifiedLicense('person_rezaei');
  assert(!!verifiedLicenseCheck, 'مجوز تأییدشده رضایی پیدا شد');

  // ─── Test 17: Subscription Search ───

  section('۱۷. جستجوی اشتراک‌ها');

  const activeSubs = subscriptionService.search({ status: 'active' });
  assert(activeSubs.length >= 1, `اشتراک‌های فعال: ${activeSubs.length} ≥ ۱`);

  const rezaeiSubs = subscriptionService.search({ personId: 'person_rezaei' });
  assert(rezaeiSubs.length >= 1, `اشتراک‌های رضایی: ${rezaeiSubs.length} ≥ ۱`);

  // ─── Test 18: Subscription Statistics ───

  section('۱۸. آمار اشتراک‌ها');

  const subStats = subscriptionService.getStats();
  assert(subStats.total >= 4, `مجموع: ${subStats.total} ≥ ۴`);
  assert(subStats.active >= 1, `فعال: ${subStats.active} ≥ ۱`);
  assert(subStats.expired >= 1, `منقضی: ${subStats.expired} ≥ ۱`);
  assert(subStats.cancelled >= 1, `لغو: ${subStats.cancelled} ≥ ۱`);
  assert(subStats.revenue > 0, `درآمد: ${subStats.revenue} > ۰`);

  // ─── Test 19: Verification URL ───

  section('۱۹. آدرس استعلام خارجی');

  const paintingUrl = licenseService.getVerificationUrl('house_painting');
  assert(paintingUrl.includes('sanat.ir'), 'آدرس استعلام نقاشی: sanat.ir');

  const unknownUrl = licenseService.getVerificationUrl('unknown_profession');
  assert(unknownUrl.includes('sanat.ir'), 'آدرس پیش‌فرض: sanat.ir');

  // ─── Test 20: Cannot Activate Without Verified License ───

  section('۲۰. فعال‌سازی بدون مجوز تأییدشده');

  // Create a subscription with a pending license
  const pendingReg = await subscriptionService.registerProfessional({
    personId: 'person_pending',
    personName: 'شخص در انتظار',
    zoneId: 'zone_vanak',
    license: {
      personId: 'person_pending',
      personName: 'شخص در انتظار',
      licenseNumber: '55555/م',
      licenseImageUrl: 'https://cdn.zone.ir/pending.jpg',
      profession: 'locksmith',
      zoneId: 'zone_vanak',
    },
    planId: 'monthly',
  });

  // Try to activate without verifying the license
  let noVerifyError = false;
  try {
    await subscriptionService.activateSubscription({
      subscriptionId: pendingReg.subscription.id,
      paymentReference: 'PAY-NO-VERIFY',
    });
  } catch (err: any) {
    noVerifyError = err.message.includes('تأیید نشده');
  }
  assert(noVerifyError, 'فعال‌سازی بدون مجوز تأییدشده رد میشه');

  // ─── Summary ───

  section('خلاصه آزمون');

  console.log(`\n  ✅ موفق: ${passed}`);
  console.log(`  ❌ ناموفق: ${failed}`);
  console.log(`  📊 مجموع: ${passed + failed}`);

  if (failed === 0) {
    console.log('\n  🎉 فاز ۹ — همه آزمون‌ها موفق!');
  } else {
    console.log(`\n  ⚠️  ${failed} آزمون ناموفق`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
