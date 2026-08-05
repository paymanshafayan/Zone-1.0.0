/// Profile Provider — User profile state management
///
/// Manages: display name, zone, skills, professional status, tag subscriptions
library features_settings_providers_profile_provider;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/utils/logger.dart';
import '../../../shared/models/zone_models.dart';
import '../../../shared/services/navigation_service.dart';

// ─── Profile State ───

class ProfileState {
  final String personId;
  final String displayName;
  final String zoneId;
  final String zoneName;
  final List<String> skills;
  final ProfessionalStatus professionalStatus;
  final List<String> subscribedTags;
  final int memoriesRecorded;
  final int demandsFulfilled;
  final double trustScore;

  const ProfileState({
    this.personId = '',
    this.displayName = '',
    this.zoneId = '',
    this.zoneName = '',
    this.skills = const [],
    this.professionalStatus = ProfessionalStatus.normal,
    this.subscribedTags = const [],
    this.memoriesRecorded = 0,
    this.demandsFulfilled = 0,
    this.trustScore = 0.0,
  });

  ProfileState copyWith({
    String? personId,
    String? displayName,
    String? zoneId,
    String? zoneName,
    List<String>? skills,
    ProfessionalStatus? professionalStatus,
    List<String>? subscribedTags,
    int? memoriesRecorded,
    int? demandsFulfilled,
    double? trustScore,
  }) {
    return ProfileState(
      personId: personId ?? this.personId,
      displayName: displayName ?? this.displayName,
      zoneId: zoneId ?? this.zoneId,
      zoneName: zoneName ?? this.zoneName,
      skills: skills ?? this.skills,
      professionalStatus: professionalStatus ?? this.professionalStatus,
      subscribedTags: subscribedTags ?? this.subscribedTags,
      memoriesRecorded: memoriesRecorded ?? this.memoriesRecorded,
      demandsFulfilled: demandsFulfilled ?? this.demandsFulfilled,
      trustScore: trustScore ?? this.trustScore,
    );
  }
}

// ─── Profile Provider ───

final profileProvider = StateNotifierProvider<ProfileNotifier, ProfileState>((ref) {
  return ProfileNotifier(ref);
});

class ProfileNotifier extends StateNotifier<ProfileState> {
  final Ref _ref;
  final ZoneLogger _logger = ZoneLogger('Profile');

  ProfileNotifier(this._ref) : super(const ProfileState()) {
    _loadFromPrefs();
  }

  /// Load profile from SharedPreferences
  Future<void> _loadFromPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      state = ProfileState(
        personId: prefs.getString('personId') ?? '',
        displayName: prefs.getString('displayName') ?? '',
        zoneId: prefs.getString('zoneId') ?? '',
        zoneName: prefs.getString('zoneName') ?? '',
        skills: prefs.getStringList('skills') ?? [],
        subscribedTags: prefs.getStringList('subscribedTags') ?? [
          'services/*', 'urgency/*', 'social/*', 'support/*',
        ],
      );
    } catch (e) {
      _logger.error('Failed to load profile from prefs', e);
    }
  }

  /// Save profile to SharedPreferences
  Future<void> _saveToPrefs() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('personId', state.personId);
      await prefs.setString('displayName', state.displayName);
      await prefs.setString('zoneId', state.zoneId);
      await prefs.setString('zoneName', state.zoneName);
      await prefs.setStringList('skills', state.skills);
      await prefs.setStringList('subscribedTags', state.subscribedTags);
    } catch (e) {
      _logger.error('Failed to save profile to prefs', e);
    }
  }

  /// Update display name
  Future<void> updateDisplayName(String name) async {
    state = state.copyWith(displayName: name);
    await _saveToPrefs();
    _ref.read(authProvider.notifier).login(
      state.personId,
      name,
      state.zoneId,
    );
  }

  /// Update zone
  Future<void> updateZone(String zoneId, String zoneName) async {
    state = state.copyWith(zoneId: zoneId, zoneName: zoneName);
    await _saveToPrefs();
    _ref.read(authProvider.notifier).setZone(zoneId);
  }

  /// Add a skill
  Future<void> addSkill(String skill) async {
    if (!state.skills.contains(skill)) {
      state = state.copyWith(skills: [...state.skills, skill]);
      await _saveToPrefs();
    }
  }

  /// Remove a skill
  Future<void> removeSkill(String skill) async {
    state = state.copyWith(
      skills: state.skills.where((s) => s != skill).toList(),
    );
    await _saveToPrefs();
  }

  /// Toggle tag subscription
  Future<void> toggleTagSubscription(String tagPattern) async {
    final tags = [...state.subscribedTags];
    if (tags.contains(tagPattern)) {
      tags.remove(tagPattern);
    } else {
      tags.add(tagPattern);
    }
    state = state.copyWith(subscribedTags: tags);
    await _saveToPrefs();
  }

  /// Check if subscribed to a tag pattern
  bool isSubscribedTo(String tagPattern) {
    return state.subscribedTags.contains(tagPattern);
  }

  /// Initialize profile after onboarding
  Future<void> initializeFromOnboarding({
    required String personId,
    required String displayName,
    required String zoneId,
    required List<String> skills,
    required List<String> subscribedTags,
  }) async {
    state = ProfileState(
      personId: personId,
      displayName: displayName,
      zoneId: zoneId,
      skills: skills,
      subscribedTags: subscribedTags,
    );
    await _saveToPrefs();
    _ref.read(authProvider.notifier).login(personId, displayName, zoneId);
  }
}
