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
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/constants/app_constants.dart';
import '../../../core/theme/app_theme.dart';
import '../../../shared/models/zone_models.dart';
import '../../../shared/services/navigation_service.dart';
import '../providers/professional_provider.dart';

class ProfessionalHubScreen extends ConsumerStatefulWidget {
  const ProfessionalHubScreen({super.key});

  @override
  ConsumerState<ProfessionalHubScreen> createState() =>
      _ProfessionalHubScreenState();
}

class _ProfessionalHubScreenState extends ConsumerState<ProfessionalHubScreen> {
  @override
  void initState() {
    super.initState();
    // Refresh professional status from the backend (when available).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final personId = ref.read(authProvider).personId;
      if (personId != null) {
        ref.read(professionalProvider.notifier).checkStatus(personId);
      }
    });
  }

  /// Local plan list — mirrors the published prices so the hub is useful
  /// even when the API isn't reachable yet.
  static const List<SubscriptionPlan> _fallbackPlans = [
    SubscriptionPlan(
      id: 'monthly',
      name: 'ماهانه',
      durationDays: AppConstants.monthlyDurationDays,
      price: AppConstants.monthlyPrice,
      discount: 0,
    ),
    SubscriptionPlan(
      id: 'quarterly',
      name: 'سه‌ماهه',
      durationDays: AppConstants.quarterlyDurationDays,
      price: AppConstants.quarterlyPrice,
      discount: 0.11,
    ),
    SubscriptionPlan(
      id: 'annual',
      name: 'سالانه',
      durationDays: AppConstants.annualDurationDays,
      price: AppConstants.annualPrice,
      discount: 0.22,
    ),
  ];

  @override
  Widget build(BuildContext context) {
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
  Widget _buildActiveProfessional(
      BuildContext context, WidgetRef ref, ProfessionalState state) {
    final plans = state.plans.isNotEmpty ? state.plans : _fallbackPlans;

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
                  const Icon(Icons.verified,
                      color: AppTheme.accentKnow, size: 32),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'حساب حرفه‌ای فعال',
                          style:
                              Theme.of(context).textTheme.titleMedium?.copyWith(
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
          ...plans.map((plan) => _buildPlanCard(context, ref, plan)),

          const SizedBox(height: 24),

          // ─── Actions ───
          OutlinedButton.icon(
            onPressed: () => context.push('/post/create'),
            icon: const Icon(Icons.add_photo_alternate),
            label: const Text('ایجاد پست حرفه‌ای'),
          ),
        ],
      ),
    );
  }

  Widget _buildPlanCard(
      BuildContext context, WidgetRef ref, SubscriptionPlan plan) {
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
                const SizedBox(height: 4),
                Text(
                  'پرداخت در سایت خارجی',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppTheme.textSecondaryLight,
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
  Widget _buildRegistrationFlow(
      BuildContext context, WidgetRef ref, ProfessionalState state) {
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
              border:
                  Border.all(color: AppTheme.professionalGold.withValues(alpha: 0.3)),
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
          _buildStep(context, 1, 'مجوز اتحادیه',
              'تصویر مجوز + شماره یکتا رو آپلود کن'),
          _buildStep(context, 2, 'تأیید مجوز',
              'مجوز از طریق سایت استعلام تأیید میشه'),
          _buildStep(context, 3, 'پرداخت اشتراک',
              'لینک پرداخت به سایت خارجی ارسال میشه'),
          _buildStep(context, 4, 'حساب فعال', 'می‌تونی پست حرفه‌ای بذاری!'),
          const SizedBox(height: 24),

          // ─── Register button ───
          ElevatedButton(
            onPressed: () => _showRegistrationForm(context),
            child: const Text('شروع ثبت‌نام'),
          ),
        ],
      ),
    );
  }

  Widget _buildStep(
      BuildContext context, int number, String title, String description) {
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
                Text(description,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.textSecondaryLight,
                        )),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showRegistrationForm(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => _RegistrationSheet(parentContext: context),
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

/// Professional registration form — collects profession, licence number,
/// and a licence photo, then submits to the backend.
class _RegistrationSheet extends ConsumerStatefulWidget {
  /// The Scaffold's context — used for post-submit SnackBars.
  final BuildContext parentContext;

  const _RegistrationSheet({required this.parentContext});

  @override
  ConsumerState<_RegistrationSheet> createState() =>
      _RegistrationSheetState();
}

class _RegistrationSheetState extends ConsumerState<_RegistrationSheet> {
  final TextEditingController _professionController = TextEditingController();
  final TextEditingController _licenseNumberController =
      TextEditingController();
  final ImagePicker _picker = ImagePicker();

  XFile? _licenseImage;
  bool _isSubmitting = false;
  String? _formError;

  @override
  void dispose() {
    _professionController.dispose();
    _licenseNumberController.dispose();
    super.dispose();
  }

  Future<void> _pickLicenseImage() async {
    try {
      final picked = await _picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        imageQuality: 85,
      );
      if (picked != null && mounted) {
        setState(() => _licenseImage = picked);
      }
    } catch (_) {
      // Permission denied or picker unavailable — keep the form usable.
      if (mounted) {
        setState(
            () => _formError = 'دسترسی به گالری ممکن نشد. دوباره تلاش کن.');
      }
    }
  }

  Future<void> _submit() async {
    final profession = _professionController.text.trim();
    final licenseNumber = _licenseNumberController.text.trim();

    if (profession.isEmpty || licenseNumber.isEmpty) {
      setState(() => _formError = 'نوع حرفه و شماره مجوز رو کامل بنویس.');
      return;
    }

    setState(() {
      _formError = null;
      _isSubmitting = true;
    });

    final personId = ref.read(authProvider).personId ?? 'anonymous';
    // The licence image gets uploaded to object storage (Arvan) with the
    // media pipeline; until that endpoint lands we send the local path as
    // the reference so the registration payload stays complete.
    final success = await ref.read(professionalProvider.notifier).register(
          personId: personId,
          profession: profession,
          licenseNumber: licenseNumber,
          licenseImageUrl: _licenseImage?.path ?? '',
        );

    if (!mounted) return;
    setState(() => _isSubmitting = false);

    if (success) {
      Navigator.of(context).pop();
      ScaffoldMessenger.of(widget.parentContext).showSnackBar(
        const SnackBar(
          content: Text('درخواست ثبت‌نام ارسال شد. بعد از تأیید مجوز فعال میشه ✓'),
          backgroundColor: AppTheme.accentKnow,
        ),
      );
    } else {
      final message = ref.read(professionalProvider).errorMessage;
      ScaffoldMessenger.of(widget.parentContext).showSnackBar(
        SnackBar(
          content: Text(message ?? 'ارسال درخواست ممکن نشد. دوباره تلاش کن.'),
          backgroundColor: AppTheme.accentEmergency,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
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
            controller: _professionController,
            textDirection: TextDirection.rtl,
            decoration: const InputDecoration(
              labelText: 'نوع حرفه',
              hintText: 'مثلاً: نقاش ساختمان',
            ),
          ),
          const SizedBox(height: 12),

          // ─── License number ───
          TextField(
            controller: _licenseNumberController,
            textDirection: TextDirection.rtl,
            decoration: const InputDecoration(
              labelText: 'شماره مجوز اتحادیه',
              hintText: 'مثلاً: ۱۲۳۴۵/م',
            ),
          ),
          const SizedBox(height: 12),

          // ─── License image upload ───
          OutlinedButton.icon(
            onPressed: _isSubmitting ? null : _pickLicenseImage,
            icon: Icon(
              _licenseImage != null ? Icons.check_circle : Icons.camera_alt,
              color: _licenseImage != null ? AppTheme.accentKnow : null,
            ),
            label: Text(
              _licenseImage != null
                  ? 'تصویر مجوز انتخاب شد ✓'
                  : 'آپلود تصویر مجوز',
            ),
          ),

          // ─── Form error ───
          if (_formError != null) ...[
            const SizedBox(height: 12),
            Text(
              _formError!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.accentEmergency,
                  ),
            ),
          ],
          const SizedBox(height: 20),

          // ─── Submit ───
          ElevatedButton(
            onPressed: _isSubmitting ? null : _submit,
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('ارسال برای تأیید'),
          ),
        ],
      ),
    );
  }
}
