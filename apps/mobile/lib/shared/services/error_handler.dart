/// Global Error Handler — Centralized error handling for the app
///
/// Handles:
/// - API errors (network, server, auth)
/// - WebSocket disconnections
/// - Unhandled exceptions
/// - User-friendly error messages in Persian

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_theme.dart';
import '../../core/utils/logger.dart';

// ─── Error Types ───

enum ZoneErrorType {
  network,
  server,
  auth,
  validation,
  notFound,
  timeout,
  unknown,
}

// ─── Zone Error ───

class ZoneError {
  final ZoneErrorType type;
  final String message;
  final String? details;
  final DateTime timestamp;

  const ZoneError({
    required this.type,
    required this.message,
    this.details,
    required this.timestamp,
  });

  factory ZoneError.fromException(dynamic error) {
    final logger = ZoneLogger('ErrorHandler');
    logger.error('Exception caught', error);

    if (error.toString().contains('SocketException') ||
        error.toString().contains('Connection refused')) {
      return ZoneError(
        type: ZoneErrorType.network,
        message: 'اتصال به سرور برقرار نیست. اینترنتت رو چک کن.',
        timestamp: DateTime.now(),
      );
    }

    if (error.toString().contains('401') || error.toString().contains('Unauthorized')) {
      return ZoneError(
        type: ZoneErrorType.auth,
        message: 'لطفاً دوباره وارد شو.',
        timestamp: DateTime.now(),
      );
    }

    if (error.toString().contains('404')) {
      return ZoneError(
        type: ZoneErrorType.notFound,
        message: 'پیدا نشد.',
        timestamp: DateTime.now(),
      );
    }

    if (error.toString().contains('TimeoutException') ||
        error.toString().contains('timeout')) {
      return ZoneError(
        type: ZoneErrorType.timeout,
        message: 'سرور پاسخ نمیده. دوباره تلاش کن.',
        timestamp: DateTime.now(),
      );
    }

    return ZoneError(
      type: ZoneErrorType.unknown,
      message: 'خطای غیرمنتظره. لطفاً بعداً تلاش کن.',
      details: error.toString(),
      timestamp: DateTime.now(),
    );
  }
}

// ─── Error Handler Provider ───

final errorProvider = StateProvider<ZoneError?>((ref) => null);

// ─── Error Reporter ───

class ZoneErrorHandler {
  static final ZoneLogger _logger = ZoneLogger('ErrorHandler');

  /// Report an error
  static void report(dynamic error, [StackTrace? stackTrace]) {
    _logger.error('Error reported', error, stackTrace);
    // In production: send to Sentry, Crashlytics, etc.
  }

  /// Show error as a snackbar
  static void showSnackBar(BuildContext context, ZoneError error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(error.message),
        backgroundColor: _getColor(error.type),
        duration: const Duration(seconds: 4),
        action: error.type == ZoneErrorType.network
            ? SnackBarAction(
                label: 'تلاش دوباره',
                textColor: Colors.white,
                onPressed: () {
                  // Retry logic handled by caller
                },
              )
            : null,
      ),
    );
  }

  static Color _getColor(ZoneErrorType type) {
    switch (type) {
      case ZoneErrorType.network:
        return AppTheme.accentUnknown;
      case ZoneErrorType.auth:
        return AppTheme.accentEmergency;
      case ZoneErrorType.notFound:
        return AppTheme.textSecondaryLight;
      default:
        return AppTheme.accentEmergency;
    }
  }
}
