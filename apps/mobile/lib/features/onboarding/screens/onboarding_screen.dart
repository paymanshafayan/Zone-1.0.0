/// Onboarding Screen — First-time user setup
///
/// Steps:
///   1. Welcome → explain what Zone is
///   2. Choose neighbourhood (map-based, Neshan)
///   3. Set skills (what you can help with)
///   4. Tag preferences (what you want to hear)
///   5. Done → start using Zone
library features_onboarding_screens_onboarding_screen;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../shared/services/navigation_service.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _pageController = PageController();
  int _currentPage = 0;
  String _selectedNeighbourhood = '';
  final List<String> _selectedSkills = [];
  final List<String> _selectedTags = [];

  static const _pages = [
    _OnboardingPageData(
      icon: Icons.hearing,
      title: 'سلام! من زونم',
      description: 'رفیق محله‌اتم. با من حرف بزن، نه سرچ کن.\n'
          'اگه چیزی رو نمی‌دونم، صادقانه میگم.\n'
          'با گذشت زمان بیشتر یاد می‌گیرم.',
      color: AppTheme.primaryLight,
    ),
    _OnboardingPageData(
      icon: Icons.location_on,
      title: 'محله‌ات رو انتخاب کن',
      description: 'زون فقط محله‌ات رو می‌شناسه.\n'
          'دانش محله‌ها به هم نشت نمی‌کنه.',
      color: AppTheme.accentAsk,
    ),
    _OnboardingPageData(
      icon: Icons.build,
      title: 'چه مهارتی داری؟',
      description: 'اگه بتونی به همسایه‌ها کمک کنی،\n'
          'اینجا بذار. اجباری نیست.',
      color: AppTheme.accentKnow,
    ),
    _OnboardingPageData(
      icon: Icons.notifications_active,
      title: 'چی می‌خوای بشنوی؟',
      description: 'انتخاب کن کدوم برچسب‌ها رو بشنوی.\n'
          'کانال اضطراری همیشه فعاله.',
      color: AppTheme.accentUnknown,
    ),
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // ─── Skip button ───
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: _finishOnboarding,
                child: const Text('رد شدن'),
              ),
            ),

            // ─── Pages ───
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (page) => setState(() => _currentPage = page),
                itemCount: _pages.length,
                itemBuilder: (context, index) {
                  final page = _pages[index];
                  return _buildPage(context, page, index);
                },
              ),
            ),

            // ─── Page indicators ───
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(
                  _pages.length,
                  (index) => Container(
                    width: _currentPage == index ? 24 : 8,
                    height: 8,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: _currentPage == index
                          ? AppTheme.primaryLight
                          : AppTheme.primaryLight.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ),
              ),
            ),

            // ─── Navigation buttons ───
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (_currentPage > 0)
                    TextButton(
                      onPressed: _previousPage,
                      child: const Text('قبلی'),
                    ),
                  const Spacer(),
                  ElevatedButton(
                    onPressed: _currentPage == _pages.length - 1
                        ? _finishOnboarding
                        : _nextPage,
                    child: Text(
                      _currentPage == _pages.length - 1 ? 'شروع' : 'بعدی',
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPage(BuildContext context, _OnboardingPageData page, int index) {
    return Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 100,
            height: 100,
            decoration: BoxDecoration(
              color: page.color.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: Icon(page.icon, size: 48, color: page.color),
          ),
          const SizedBox(height: 24),
          Text(
            page.title,
            style: Theme.of(context).textTheme.headlineMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            page.description,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppTheme.textSecondaryLight,
              height: 1.8,
            ),
            textAlign: TextAlign.center,
          ),

          // ─── Specific content per page ───
          if (index == 1) ...[
            const SizedBox(height: 24),
            // Neighbourhood selection (placeholder for Neshan map)
            OutlinedButton.icon(
              onPressed: () {
                // In production: open Neshan map
                setState(() => _selectedNeighbourhood = 'قیطریه');
              },
              icon: const Icon(Icons.map),
              label: Text(
                _selectedNeighbourhood.isEmpty
                    ? 'انتخاب از نقشه'
                    : _selectedNeighbourhood,
              ),
            ),
          ],

          if (index == 2) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                'نقاشی', 'لوله‌کشی', 'برقکاری', 'نجاری',
                'کاشی‌کاری', 'تعمیرات', 'نظافت', 'باربری',
              ].map((skill) => FilterChip(
                label: Text(skill),
                selected: _selectedSkills.contains(skill),
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedSkills.add(skill);
                    } else {
                      _selectedSkills.remove(skill);
                    }
                  });
                },
              )).toList(),
            ),
          ],

          if (index == 3) ...[
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                'خدمات', 'اجتماعی', 'حمایتی', 'فوری',
              ].map((tag) => FilterChip(
                label: Text(tag),
                selected: _selectedTags.contains(tag),
                onSelected: (selected) {
                  setState(() {
                    if (selected) {
                      _selectedTags.add(tag);
                    } else {
                      _selectedTags.remove(tag);
                    }
                  });
                },
              )).toList(),
            ),
          ],
        ],
      ),
    );
  }

  void _nextPage() {
    _pageController.nextPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _previousPage() {
    _pageController.previousPage(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  void _finishOnboarding() {
    ref.read(authProvider.notifier).login(
      'user_${DateTime.now().millisecondsSinceEpoch}',
      'کاربر',
      _selectedNeighbourhood.isEmpty ? 'default' : _selectedNeighbourhood,
    );
  }
}

class _OnboardingPageData {
  final IconData icon;
  final String title;
  final String description;
  final Color color;

  const _OnboardingPageData({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
  });
}
