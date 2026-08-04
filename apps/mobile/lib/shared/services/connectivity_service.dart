/// Connectivity Service — Online/offline detection
///
/// Zone needs to work gracefully when offline:
/// - Voice input still works (on-device processing)
/// - Cached data is available
/// - User is informed of offline status
/// - Automatic retry when back online

import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../../core/utils/logger.dart';

// ─── Connectivity State ───

class ConnectivityState {
  final bool isOnline;
  final DateTime? lastOnlineAt;
  final DateTime? lastOfflineAt;

  const ConnectivityState({
    this.isOnline = true,
    this.lastOnlineAt,
    this.lastOfflineAt,
  });

  ConnectivityState copyWith({
    bool? isOnline,
    DateTime? lastOnlineAt,
    DateTime? lastOfflineAt,
  }) {
    return ConnectivityState(
      isOnline: isOnline ?? this.isOnline,
      lastOnlineAt: lastOnlineAt ?? this.lastOnlineAt,
      lastOfflineAt: lastOfflineAt ?? this.lastOfflineAt,
    );
  }
}

// ─── Connectivity Provider ───

final connectivityProvider =
    StateNotifierProvider<ConnectivityNotifier, ConnectivityState>((ref) {
  return ConnectivityNotifier();
});

class ConnectivityNotifier extends StateNotifier<ConnectivityState> {
  final Connectivity _connectivity = Connectivity();
  final ZoneLogger _logger = ZoneLogger('Connectivity');
  StreamSubscription? _subscription;

  ConnectivityNotifier() : super(const ConnectivityState()) {
    _init();
  }

  void _init() {
    _subscription = _connectivity.onConnectivityChanged.listen((results) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      final wasOnline = state.isOnline;

      if (isOnline != wasOnline) {
        state = state.copyWith(
          isOnline: isOnline,
          lastOnlineAt: isOnline ? DateTime.now() : state.lastOnlineAt,
          lastOfflineAt: !isOnline ? DateTime.now() : state.lastOfflineAt,
        );

        if (isOnline) {
          _logger.info('Back online');
        } else {
          _logger.warning('Went offline');
        }
      }
    });

    // Check initial state
    _connectivity.checkConnectivity().then((results) {
      final isOnline = results.any((r) => r != ConnectivityResult.none);
      state = ConnectivityState(
        isOnline: isOnline,
        lastOnlineAt: isOnline ? DateTime.now() : null,
      );
    });
  }

  @override
  void dispose() {
    _subscription?.cancel();
    super.dispose();
  }
}

// ─── Offline-aware API wrapper ───

/// Extension on WidgetRef to check connectivity before API calls
extension ConnectivityCheck on Ref {
  bool get isOnline => read(connectivityProvider).isOnline;
}
