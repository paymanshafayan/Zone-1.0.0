/// Zone Logger — Simple structured logger for the Flutter app
library core_utils_logger;

import 'package:flutter/foundation.dart';

class ZoneLogger {
  final String context;

  ZoneLogger(this.context);

  void debug(String message, [dynamic data]) {
    _log('DEBUG', message, data);
  }

  void info(String message, [dynamic data]) {
    _log('INFO', message, data);
  }

  void warning(String message, [dynamic data]) {
    _log('WARN', message, data);
  }

  void error(String message, [dynamic error, StackTrace? stackTrace]) {
    _log('ERROR', message, error);
    if (stackTrace != null) {
      // In production, send to error tracking service
    }
  }

  void _log(String level, String message, [dynamic data]) {
    // In production: use a proper logging service (e.g., Sentry, Firebase Crashlytics)
    final timestamp = DateTime.now().toIso8601String();
    final buffer = StringBuffer();
    buffer.write('[$timestamp] [$level] [$context] $message');
    if (data != null) {
      buffer.write(' | $data');
    }
    // ignore: avoid_print
    debugPrint(buffer.toString());
  }
}
