/// Navigation Service — GoRouter configuration
///
/// Route structure:
///   /             → Main shell (voice + visual + hearing + profile)
///   /voice        → Voice channel (assistant)
///   /visual       → Visual channel (professional feed)
///   /hearing      → Hearing spaces
///   /professional → Professional registration & subscription
///   /settings     → Settings, notifications, tag preferences
///   /onboarding   → First-time setup
///   /post/:id     → Post detail
///   /post/create  → Create professional post
///   /profile      → User profile
///   /notifications → Notification list
///   /wave/:id     → Wave status

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/voice/screens/voice_screen.dart';
import '../../features/visual/screens/visual_feed_screen.dart';
import '../../features/visual/screens/post_detail_screen.dart';
import '../../features/hearing/screens/hearing_spaces_screen.dart';
import '../../features/professional/screens/professional_hub_screen.dart';
import '../../features/professional/screens/create_post_screen.dart';
import '../../features/settings/screens/settings_screen.dart';
import '../../features/settings/screens/profile_screen.dart';
import '../../features/settings/screens/notifications_screen.dart';
import '../../features/auth/screens/auth_screen.dart';
import '../../features/onboarding/screens/onboarding_screen.dart';
import '../widgets/main_shell.dart';
import '../models/zone_models.dart';

// ─── Router Provider ───

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/voice',
    redirect: (context, state) {
      final isOnboarding = state.matchedLocation == '/onboarding';
      final isAuth = state.matchedLocation == '/auth';

      if (!authState.isAuthenticated && !isAuth && !isOnboarding) {
        return '/auth';
      }
      if (authState.isAuthenticated && isAuth) {
        return '/voice';
      }
      if (authState.isNewUser && !isOnboarding) {
        return '/onboarding';
      }
      return null;
    },
    routes: [
      // ─── Auth & Onboarding ───
      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthScreen(),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingScreen(),
      ),

      // ─── Main Shell (Bottom Navigation) ───
      ShellRoute(
        builder: (context, state, child) {
          return MainShell(child: child);
        },
        routes: [
          GoRoute(
            path: '/voice',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: VoiceScreen(),
            ),
          ),
          GoRoute(
            path: '/visual',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: VisualFeedScreen(),
            ),
          ),
          GoRoute(
            path: '/hearing',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HearingSpacesScreen(),
            ),
          ),
          GoRoute(
            path: '/professional',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ProfessionalHubScreen(),
            ),
          ),
          GoRoute(
            path: '/settings',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SettingsScreen(),
            ),
          ),
        ],
      ),

      // ─── Detail Pages (outside shell) ───
      GoRoute(
        path: '/post/create',
        builder: (context, state) => const CreatePostScreen(),
      ),
      GoRoute(
        path: '/post/:id',
        builder: (context, state) {
          // In production: fetch post from API
          return PostDetailScreen(
            post: Post(
              id: state.pathParameters['id'] ?? '',
              zoneId: 'default',
              providerId: 'provider_1',
              media: [],
              description: 'پست حرفه‌ای نمونه',
              tags: ['services/house_painting'],
              isSponsored: true,
              isActive: true,
              publishedAt: DateTime.now(),
            ),
          );
        },
      ),
      GoRoute(
        path: '/profile',
        builder: (context, state) => const ProfileScreen(),
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
    ],
  );
});

// ─── Auth Provider ───

class AuthState {
  final bool isAuthenticated;
  final bool isNewUser;
  final String? personId;
  final String? displayName;
  final String? zoneId;

  const AuthState({
    this.isAuthenticated = false,
    this.isNewUser = false,
    this.personId,
    this.displayName,
    this.zoneId,
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? isNewUser,
    String? personId,
    String? displayName,
    String? zoneId,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isNewUser: isNewUser ?? this.isNewUser,
      personId: personId ?? this.personId,
      displayName: displayName ?? this.displayName,
      zoneId: zoneId ?? this.zoneId,
    );
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier();
});

class AuthNotifier extends StateNotifier<AuthState> {
  AuthNotifier() : super(const AuthState());

  void login(String personId, String displayName, String zoneId) {
    state = AuthState(
      isAuthenticated: true,
      isNewUser: false,
      personId: personId,
      displayName: displayName,
      zoneId: zoneId,
    );
  }

  void logout() {
    state = const AuthState();
  }

  void setZone(String zoneId) {
    state = state.copyWith(zoneId: zoneId);
  }
}
