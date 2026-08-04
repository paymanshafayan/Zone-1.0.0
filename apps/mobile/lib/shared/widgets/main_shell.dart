/// Main Shell — Bottom navigation + body
///
/// Two channels (voice + visual) + hearing + professional + settings
/// RTL layout, Persian labels, Vazirmatn font
library shared_widgets_main_shell;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';

class MainShell extends StatelessWidget {
  final Widget child;

  const MainShell({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: child,
      bottomNavigationBar: _BottomNav(),
    );
  }
}

class _BottomNav extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;

    int currentIndex = 0;
    if (location.startsWith('/visual')) {
      currentIndex = 1;
    } else if (location.startsWith('/hearing')) {
      currentIndex = 2;
    } else if (location.startsWith('/professional')) {
      currentIndex = 3;
    } else if (location.startsWith('/settings')) {
      currentIndex = 4;
    }

    return Container(
      decoration: BoxDecoration(
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) {
          switch (index) {
            case 0: context.go('/voice'); break;
            case 1: context.go('/visual'); break;
            case 2: context.go('/hearing'); break;
            case 3: context.go('/professional'); break;
            case 4: context.go('/settings'); break;
          }
        },
        height: 72,
        backgroundColor: Theme.of(context).colorScheme.surface,
        indicatorColor: AppTheme.primaryLight.withValues(alpha: 0.15),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.mic_outlined),
            selectedIcon: Icon(Icons.mic),
            label: 'صوتی',
          ),
          NavigationDestination(
            icon: Icon(Icons.grid_view_outlined),
            selectedIcon: Icon(Icons.grid_view),
            label: 'فید',
          ),
          NavigationDestination(
            icon: Icon(Icons.hearing_outlined),
            selectedIcon: Icon(Icons.hearing),
            label: 'فضا',
          ),
          NavigationDestination(
            icon: Icon(Icons.workspace_premium_outlined),
            selectedIcon: Icon(Icons.workspace_premium),
            label: 'حرفه‌ای',
          ),
          NavigationDestination(
            icon: Icon(Icons.settings_outlined),
            selectedIcon: Icon(Icons.settings),
            label: 'تنظیمات',
          ),
        ],
      ),
    );
  }
}
