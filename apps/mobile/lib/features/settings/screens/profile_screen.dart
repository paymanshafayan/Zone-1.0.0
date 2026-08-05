/// Profile Screen — User profile and account management
///
/// Shows: name, zone, skills, professional status, tag subscriptions, stats

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/models/zone_models.dart';
import '../../../shared/widgets/shared_widgets.dart';
import '../providers/profile_provider.dart';
import '../../professional/providers/professional_provider.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final profState = ref.watch(professionalProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('پروفایل'),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Avatar + Name ───
            Center(
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 48,
                    backgroundColor: AppTheme.primaryLight.withValues(alpha: 0.2),
                    child: Text(
                      profile.displayName.isNotEmpty
                          ? profile.displayName.substring(0, 1)
                          : 'ز',
                      style: const TextStyle(
                        fontSize: 36,
                        color: AppTheme.primaryLight,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    profile.displayName.isNotEmpty ? profile.displayName : 'کاربر',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.location_on, size: 16, color: AppTheme.textSecondaryLight),
                      const SizedBox(width: 4),
                      Text(
                        profile.zoneName.isNotEmpty ? profile.zoneName : 'محله تعیین نشده',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.textSecondaryLight,
                        ),
                      ),
                    ],
                  ),
                  if (profState.status == ProfessionalStatus.professional) ...[
                    const SizedBox(height: 8),
                    const ZoneStatusChip(
                      label: 'ارائه‌دهنده حرفه‌ای ✓',
                      color: AppTheme.professionalBadge,
                      icon: Icons.workspace_premium,
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 32),

            // ─── Edit Name ───
            Card(
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('نام نمایشی'),
                subtitle: Text(profile.displayName.isNotEmpty ? profile.displayName : 'تعیین نشده'),
                trailing: const Icon(Icons.edit, size: 20),
                onTap: () => _showEditNameDialog(context, ref, profile.displayName),
              ),
            ),
            const SizedBox(height: 8),

            // ─── Change Zone ───
            Card(
              child: ListTile(
                leading: const Icon(Icons.location_on_outlined),
                title: const Text('محله'),
                subtitle: Text(profile.zoneName.isNotEmpty ? profile.zoneName : 'انتخاب نشده'),
                trailing: const Icon(Icons.edit, size: 20),
                onTap: () => _showZonePicker(context, ref),
              ),
            ),
            const SizedBox(height: 24),

            // ─── Skills ───
            Text(
              'مهارت‌ها',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            if (profile.skills.isEmpty)
              Text(
                'هنوز مهارتی اضافه نشده. اگه بتونی به همسایه‌ها کمک کنی، اینجا اضافه کن.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: profile.skills.map((skill) {
                  return Chip(
                    label: Text(skill),
                    onDeleted: () => ref.read(profileProvider.notifier).removeSkill(skill),
                    deleteIconColor: AppTheme.accentEmergency,
                  );
                }).toList(),
              ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: () => _showAddSkillDialog(context, ref),
              icon: const Icon(Icons.add),
              label: const Text('افزودن مهارت'),
            ),
            const SizedBox(height: 24),

            // ─── Tag Subscriptions ───
            Text(
              'اشتراک برچسب',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            _buildTagSubscription(context, ref, 'خدمات', 'services/*', Icons.build),
            _buildTagSubscription(context, ref, 'فوری', 'urgency/*', Icons.bolt),
            _buildTagSubscription(context, ref, 'اجتماعی', 'social/*', Icons.people),
            _buildTagSubscription(context, ref, 'حمایتی', 'support/*', Icons.favorite),
            const SizedBox(height: 8),
            Text(
              '⚠️ کانال اضطراری (#urgency/emergency) همیشه فعاله و قابل فیلتر نیست.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 24),

            // ─── Stats ───
            Text(
              'آمار',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildStatCard(context, 'حافظه', '${profile.memoriesRecorded}', Icons.memory),
                const SizedBox(width: 12),
                _buildStatCard(context, 'یادگیری', '${profile.demandsFulfilled}', Icons.school),
                const SizedBox(width: 12),
                _buildStatCard(context, 'اعتماد', '${(profile.trustScore * 100).toInt()}%', Icons.star),
              ],
            ),
            const SizedBox(height: 24),

            // ─── Privacy ───
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.accentKnow.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.accentKnow.withValues(alpha: 0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.shield, color: AppTheme.accentKnow, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        'حریم خصوصی',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: AppTheme.accentKnow,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    '• متن خام گفتار هرگز دیوایس رو ترک نمی‌کنه\n'
                    '• فقط داده‌های ساختاریافته به سرور میره\n'
                    '• حضور فقط در کش (بدون تاریخچه)\n'
                    '• گفتگوها آرشیو نمیشن\n'
                    '• اعداد بدون تأیید وارد سیستم نمیشن',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTagSubscription(
    BuildContext context,
    WidgetRef ref,
    String label,
    String tagPattern,
    IconData icon,
  ) {
    final isSubscribed = ref.watch(profileProvider).subscribedTags.contains(tagPattern);

    return SwitchListTile(
      value: isSubscribed,
      onChanged: (value) => ref.read(profileProvider.notifier).toggleTagSubscription(tagPattern),
      secondary: Icon(icon, color: AppTheme.primaryLight),
      title: Text(label),
      subtitle: Text(tagPattern, style: const TextStyle(fontFamily: 'monospace')),
      contentPadding: EdgeInsets.zero,
      dense: true,
    );
  }

  Widget _buildStatCard(BuildContext context, String label, String value, IconData icon) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            children: [
              Icon(icon, color: AppTheme.primaryLight, size: 24),
              const SizedBox(height: 4),
              Text(value, style: Theme.of(context).textTheme.titleMedium),
              Text(label, style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondaryLight,
              )),
            ],
          ),
        ),
      ),
    );
  }

  void _showEditNameDialog(BuildContext context, WidgetRef ref, String currentName) {
    final controller = TextEditingController(text: currentName);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('نام نمایشی'),
        content: TextField(
          controller: controller,
          textDirection: TextDirection.rtl,
          decoration: const InputDecoration(hintText: 'نامت رو وارد کن'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف'),
          ),
          ElevatedButton(
            onPressed: () {
              if (controller.text.trim().isNotEmpty) {
                ref.read(profileProvider.notifier).updateDisplayName(controller.text.trim());
              }
              Navigator.pop(context);
            },
            child: const Text('ذخیره'),
          ),
        ],
      ),
    );
  }

  void _showZonePicker(BuildContext context, WidgetRef ref) {
    // Placeholder: in production, use Neshan map
    final zones = [
      ('قیطریه', 'qeytariyeh'),
      ('نارک', 'narak'),
      ('تهرانپارس', 'tehranpars'),
      ('ونک', 'vanak'),
      ('جردن', 'jordan'),
      ('پونک', 'ponak'),
      ('سعادت‌آباد', 'saadat_abad'),
      ('آپادانا', 'apadana'),
    ];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'انتخاب محله',
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 16),
              // In production: Neshan map
              Text(
                'در نسخه نهایی، نقشه نشان نمایش داده میشه.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
              ),
              const SizedBox(height: 16),
              ...zones.map((zone) => ListTile(
                title: Text(zone.$1),
                onTap: () {
                  ref.read(profileProvider.notifier).updateZone(zone.$2, zone.$1);
                  Navigator.pop(context);
                },
              )),
            ],
          ),
        ),
      ),
    );
  }

  void _showAddSkillDialog(BuildContext context, WidgetRef ref) {
    final skillController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('افزودن مهارت'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: skillController,
              textDirection: TextDirection.rtl,
              decoration: const InputDecoration(
                hintText: 'مثلاً: نقاشی ساختمان',
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'مهارت‌ها اجباری نیستن. اگه بتونی به همسایه‌ها کمک کنی، اضافه کن.',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondaryLight,
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف'),
          ),
          ElevatedButton(
            onPressed: () {
              if (skillController.text.trim().isNotEmpty) {
                ref.read(profileProvider.notifier).addSkill(skillController.text.trim());
              }
              Navigator.pop(context);
            },
            child: const Text('افزودن'),
          ),
        ],
      ),
    );
  }
}
