/// Professional Hub Screen — Registration, license, subscription
///
/// Professional providers:
///   - Union license (upload image + unique number)
///   - External verification
///   - External payment (NOT in-app purchase)
///   - Three subscription plans: monthly, quarterly, annual
library features_professional_screens_professional_hub_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/zone_models.dart';
import '../providers/professional_provider.dart';

class ProfessionalHubScreen extends ConsumerWidget {
  const ProfessionalHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profState = ref.watch(professionalProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('حرفه‌ای'),
        centerTitle: true,
      ),
      body: profState.status == ProfessionalStatus.professional
          ? _buildActiveProfessional(context, ref, profState)
          : _buildRegistrationFlow(context, ref, profState),
    );
  }

  /// Active professional view
  Widget _buildActiveProfessional(BuildContext context, WidgetRef ref, ProfessionalState state) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── Status card ───
          Card(
            color: AppTheme.accentKnow.withValues(alpha: 0.1),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  const Icon(Icons.verified, color: AppTheme.accentKnow, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'حساب حرفه‌ای فعال',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppTheme.accentKnow,
                          ),
                        ),
                        Text(
                          'می‌تونی پست حرفه‌ای بذاری و در فید نمایش داده بشی.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          // ─── Subscription plans ───
          Text(
            'طرح‌های اشتراک',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          ...state.plans.map((plan) => _buildPlanCard(context, ref, plan)),

          const SizedBox(height: 24),

          // ─── Actions ───
          OutlinedButton.icon(
            onPressed: () {
              // Navigate to create post
            },
            icon: const Icon(Icons.add_photo_alternate),
            label: const Text('ایجاد پست حرفه‌ای'),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () {
              // Navigate to manage posts
            },
            icon: const Icon(Icons.manage_search),
            label: const Text('مدیریت پست‌ها'),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanCard(BuildContext context, WidgetRef ref, SubscriptionPlan plan) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    plan.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${plan.durationDays} روز',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '${_formatPrice(plan.price)} تومان',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: AppTheme.primaryLight,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (plan.discount > 0)
                  Text(
                    '${(plan.discount * 100).toInt()}% تخفیف',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppTheme.accentKnow,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  /// Registration flow (not yet professional)
  Widget _buildRegistrationFlow(BuildContext context, WidgetRef ref, ProfessionalState state) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ─── Info card ───
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppTheme.professionalGold.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.professionalGold.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.workspace_premium,
                  size: 48,
                  color: AppTheme.professionalBadge,
                ),
                const SizedBox(height: 12),
                Text(
                  'ارائه‌دهنده حرفه‌ای شو',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: AppTheme.professionalBadge,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'اگه مجوز اتحادیه داری، می‌تونی حساب حرفه‌ای باز کنی '
                  'و پست‌هایت رو تو فید حرفه‌ای نمایش بدی.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textSecondaryLight,
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // ─── Steps ───
          _buildStep(context, 1, 'مجوز اتحادیه', 'تصویر مجوز + شماره یکتا رو آپلود کن'),
          _buildStep(context, 2, 'تأیید مجوز', 'مجوز از طریق سایت استعلام تأیید میشه'),
          _buildStep(context, 3, 'پرداخت اشتراک', 'لینک پرداخت به سایت خارجی ارسال میشه'),
          _buildStep(context, 4, 'حساب فعال', 'می‌تونی پست حرفه‌ای بذاری!'),
          const SizedBox(height: 24),

          // ─── Register button ───
          ElevatedButton(
            onPressed: () => _showRegistrationForm(context, ref),
            child: const Text('شروع ثبت‌نام'),
          ),
        ],
      ),
    );
  }

  Widget _buildStep(BuildContext context, int number, String title, String description) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: AppTheme.primaryLight.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '$number',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: AppTheme.primaryLight,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                Text(description, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondaryLight,
                )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showRegistrationForm(BuildContext context, WidgetRef ref) {
    final professionController = TextEditingController();
    final licenseNumberController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'ثبت‌نام حرفه‌ای',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 20),

            // ─── Profession ───
            TextField(
              controller: professionController,
              textDirection: TextDirection.rtl,
              decoration: const InputDecoration(
                labelText: 'نوع حرفه',
                hintText: 'مثلاً: نقاش ساختمان',
              ),
            ),
            const SizedBox(height: 12),

            // ─── License number ───
            TextField(
              controller: licenseNumberController,
              textDirection: TextDirection.rtl,
              decoration: const InputDecoration(
                labelText: 'شماره مجوز اتحادیه',
                hintText: 'مثلاً: ۱۲۳۴۵/م',
              ),
            ),
            const SizedBox(height: 12),

            // ─── License image upload ───
            OutlinedButton.icon(
              onPressed: () {
                // In production: image_picker
              },
              icon: const Icon(Icons.camera_alt),
              label: const Text('آپلود تصویر مجوز'),
            ),
            const SizedBox(height: 20),

            // ─── Submit ───
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                // In production: call register
              },
              child: const Text('ارسال برای تأیید'),
            ),
          ],
        ),
      ),
    );
  }

  String _formatPrice(int price) {
    if (price >= 1000000) {
      return '${(price / 1000000).toStringAsFixed(1)} میلیون';
    }
    if (price >= 1000) {
      return '${(price / 1000).toInt()} هزار';
    }
    return '$price';
  }
}
