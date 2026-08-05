/// Cache Service — Offline data caching with SharedPreferences
///
/// Caches frequently accessed data for offline use:
/// - Tag vocabulary (synced from server)
/// - Recent posts (visual feed)
/// - User profile
/// - Learning demands
///
/// All data is cached locally with TTL for freshness.

import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/utils/logger.dart';

// ─── Cache Provider ───

final cacheProvider = Provider<CacheService>((ref) {
  return CacheService();
});

// ─── Cache Entry ───

class _CacheEntry {
  final String data;
  final DateTime cachedAt;
  final Duration ttl;

  _CacheEntry({
    required this.data,
    required this.cachedAt,
    required this.ttl,
  });

  bool get isExpired => DateTime.now().difference(cachedAt) > ttl;

  Map<String, dynamic> toJson() => {
    'data': data,
    'cachedAt': cachedAt.toIso8601String(),
    'ttlSeconds': ttl.inSeconds,
  };

  factory _CacheEntry.fromJson(Map<String, dynamic> json) => _CacheEntry(
    data: json['data'],
    cachedAt: DateTime.parse(json['cachedAt']),
    ttl: Duration(seconds: json['ttlSeconds']),
  );
}

// ─── Cache Service ───

class CacheService {
  final ZoneLogger _logger = ZoneLogger('Cache');
  SharedPreferences? _prefs;

  // ─── TTL Constants ───
  static const Duration vocabularyTtl = Duration(hours: 24);
  static const Duration postsTtl = Duration(minutes: 30);
  static const Duration profileTtl = Duration(hours: 1);
  static const Duration demandsTtl = Duration(minutes: 15);

  Future<void> _init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  /// Get cached data
  Future<T?> get<T>(String key, T Function(Map<String, dynamic>) fromJson) async {
    await _init();
    final raw = _prefs!.getString('cache_$key');
    if (raw == null) return null;

    try {
      final entry = _CacheEntry.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      if (entry.isExpired) {
        await _prefs!.remove('cache_$key');
        _logger.debug('Cache expired: $key');
        return null;
      }
      return fromJson(jsonDecode(entry.data) as Map<String, dynamic>);
    } catch (e) {
      _logger.error('Cache read error for key: $key', e);
      await _prefs!.remove('cache_$key');
      return null;
    }
  }

  /// Get cached list
  Future<List<T>> getList<T>(String key, T Function(Map<String, dynamic>) fromJson) async {
    await _init();
    final raw = _prefs!.getString('cache_$key');
    if (raw == null) return [];

    try {
      final entry = _CacheEntry.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      if (entry.isExpired) {
        await _prefs!.remove('cache_$key');
        return [];
      }
      final list = jsonDecode(entry.data) as List;
      return list.map((item) => fromJson(item as Map<String, dynamic>)).toList();
    } catch (e) {
      _logger.error('Cache list read error for key: $key', e);
      await _prefs!.remove('cache_$key');
      return [];
    }
  }

  /// Set cached data
  Future<void> set(String key, dynamic data, {Duration? ttl}) async {
    await _init();
    final entry = _CacheEntry(
      data: jsonEncode(data),
      cachedAt: DateTime.now(),
      ttl: ttl ?? Duration(minutes: 30),
    );
    await _prefs!.setString('cache_$key', jsonEncode(entry.toJson()));
    _logger.debug('Cached: $key');
  }

  /// Set cached list
  Future<void> setList<T>(String key, List<T> data, {required Duration ttl}) async {
    await set(key, data, ttl: ttl);
  }

  /// Remove cached data
  Future<void> remove(String key) async {
    await _init();
    await _prefs!.remove('cache_$key');
    _logger.debug('Cache removed: $key');
  }

  /// Clear all cache
  Future<void> clearAll() async {
    await _init();
    final keys = _prefs!.getKeys().where((k) => k.startsWith('cache_'));
    for (final key in keys) {
      await _prefs!.remove(key);
    }
    _logger.info('All cache cleared');
  }

  /// Get cache size (number of entries)
  Future<int> size() async {
    await _init();
    return _prefs!.getKeys().where((k) => k.startsWith('cache_')).length;
  }
}
