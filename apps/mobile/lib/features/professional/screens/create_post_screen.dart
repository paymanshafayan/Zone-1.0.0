/// Create Post Screen — Professional post creation
///
/// Instagram-like post creation for professional providers.
/// - Image + short video (≤15s) + text + system tags
/// - Tags are system-only (auto-extracted from description)
/// - Media picker with camera/gallery options
/// - Video duration validation (max 15 seconds)
library features_professional_screens_create_post_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/constants/app_constants.dart';
import '../../../shared/services/navigation_service.dart';
import '../providers/post_creation_provider.dart';

class CreatePostScreen extends ConsumerStatefulWidget {
  const CreatePostScreen({super.key});

  @override
  ConsumerState<CreatePostScreen> createState() => _CreatePostScreenState();
}

class _CreatePostScreenState extends ConsumerState<CreatePostScreen> {
  final _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _descriptionController.addListener(() {
      ref.read(postCreationProvider.notifier)
          .updateDescription(_descriptionController.text);
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(postCreationProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('پست حرفه‌ای جدید'),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: state.isValid && !state.isSubmitting
                ? _handleSubmit
                : null,
            child: state.isSubmitting
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('انتشار'),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ─── Media Picker ───
            Text(
              'تصویر یا ویدیو',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            _buildMediaGrid(context, state),
            const SizedBox(height: 4),
            Text(
              'حداکثر ۵ رسانه. ویدیو: حداکثر ${AppConstants.maxVideoDurationSeconds} ثانیه',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppTheme.textSecondaryLight,
              ),
            ),
            const SizedBox(height: 24),

            // ─── Description ───
            Text(
              'توضیحات',
              style: Theme.of(context).textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _descriptionController,
              textDirection: TextDirection.rtl,
              maxLines: 5,
              maxLength: AppConstants.maxPostDescriptionLength,
              decoration: InputDecoration(
                hintText: 'درباره خدماتت بنویس...',
                counterText: '',
              ),
            ),
            const SizedBox(height: 24),

            // ─── Auto-extracted Tags ───
            if (state.tags.isNotEmpty) ...[
              Text(
                'برچسب‌ها (خودکار)',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: state.tags.map((tag) {
                  return Chip(
                    label: Text(tag.split('/').last),
                    backgroundColor: AppTheme.primaryLight.withValues(alpha: 0.1),
                    deleteIcon: const Icon(Icons.auto_awesome, size: 16),
                    onDeleted: null, // System-only: can't delete
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  );
                }).toList(),
              ),
              const SizedBox(height: 8),
              Text(
                'برچسب‌ها خودکار از متن استخراج شدن. فقط سیستم برچسب می‌زنه.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: AppTheme.textSecondaryLight,
                ),
              ),
            ],

            // ─── Error Message ───
            if (state.errorMessage != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.accentEmergency.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  state.errorMessage!,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.accentEmergency,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildMediaGrid(BuildContext context, PostCreationState state) {
    return SizedBox(
      height: 120,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          // Existing media items
          ...state.mediaPaths.asMap().entries.map((entry) {
            return _buildMediaItem(context, entry.key, entry.value, state);
          }),

          // Add button
          if (state.mediaPaths.length < AppConstants.maxPostMediaCount)
            _buildAddMediaButton(context),
        ],
      ),
    );
  }

  Widget _buildMediaItem(
    BuildContext context,
    int index,
    String path,
    PostCreationState state,
  ) {
    final isVideo = path.endsWith('.mp4') || path.endsWith('.mov');

    return Padding(
      padding: const EdgeInsets.only(left: 8),
      child: Stack(
        children: [
          Container(
            width: 100,
            height: 120,
            decoration: BoxDecoration(
              color: Colors.grey.shade200,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.3)),
            ),
            child: isVideo
                ? const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.videocam, size: 32, color: AppTheme.primaryLight),
                      SizedBox(height: 4),
                      Text('ویدیو', style: TextStyle(fontSize: 12)),
                    ],
                  )
                : const Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.image, size: 32, color: AppTheme.primaryLight),
                      SizedBox(height: 4),
                      Text('تصویر', style: TextStyle(fontSize: 12)),
                    ],
                  ),
          ),

          // Remove button
          Positioned(
            top: 4,
            right: 4,
            child: GestureDetector(
              onTap: () => ref.read(postCreationProvider.notifier).removeMedia(index),
              child: Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.close, size: 14, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAddMediaButton(BuildContext context) {
    return GestureDetector(
      onTap: () => _showMediaPicker(context),
      child: Container(
        width: 100,
        height: 120,
        decoration: BoxDecoration(
          border: Border.all(
            color: AppTheme.primaryLight.withValues(alpha: 0.5),
            style: BorderStyle.solid,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_photo_alternate, size: 32, color: AppTheme.primaryLight),
            SizedBox(height: 4),
            Text('افزودن', style: TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }

  void _showMediaPicker(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'افزودن رسانه',
                style: Theme.of(sheetContext).textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: const Icon(Icons.camera_alt),
                title: const Text('دوربین'),
                subtitle: const Text('عکس بگیر'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickMedia(ImageSource.camera, isVideo: false);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library),
                title: const Text('گالری'),
                subtitle: const Text('از گالری انتخاب کن'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickMedia(ImageSource.gallery, isVideo: false);
                },
              ),
              ListTile(
                leading: const Icon(Icons.videocam),
                title: const Text('ویدیو'),
                subtitle: Text('حداکثر ${AppConstants.maxVideoDurationSeconds} ثانیه'),
                onTap: () {
                  Navigator.pop(sheetContext);
                  _pickMedia(ImageSource.gallery, isVideo: true);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Pick an image/video and add it to the draft.
  ///
  /// Video length (≤ ${AppConstants.maxVideoDurationSeconds}s) is enforced
  /// server-side when the media is uploaded.
  Future<void> _pickMedia(ImageSource source, {required bool isVideo}) async {
    final picker = ImagePicker();
    try {
      final XFile? picked = isVideo
          ? await picker.pickVideo(source: source)
          : await picker.pickImage(
              source: source, maxWidth: 1600, imageQuality: 85);
      if (picked != null) {
        ref.read(postCreationProvider.notifier).addMedia(picked.path);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('انتخاب رسانه ممکن نشد. دسترسی رو بررسی کن.'),
            backgroundColor: AppTheme.accentEmergency,
          ),
        );
      }
    }
  }

  void _handleSubmit() async {
    final auth = ref.read(authProvider);
    final success = await ref.read(postCreationProvider.notifier).submit(
      zoneId: auth.zoneId ?? 'default_zone',
      providerId: auth.personId ?? 'anonymous',
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('پست حرفه‌ای منتشر شد! ✅'),
          backgroundColor: AppTheme.accentKnow,
        ),
      );
      ref.read(postCreationProvider.notifier).reset();
      Navigator.pop(context);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('خطا در انتشار پست. دوباره تلاش کنید.'),
          backgroundColor: AppTheme.accentEmergency,
        ),
      );
    }
  }
}
