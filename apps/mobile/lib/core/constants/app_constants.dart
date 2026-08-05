/// Zone App Constants
///
/// All constants used throughout the app.
/// Centralized here for easy maintenance.
library core_constants_app_constants;

class AppConstants {
  AppConstants._();

  // ─── App Info ───
  static const String appName = 'زون';
  static const String appNameEn = 'Zone';
  static const String appVersion = '1.0.0';

  // ─── API ───
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000', // Android emulator → localhost
  );
  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'ws://10.0.2.2:3001',
  );

  // ─── Timing ───
  static const Duration voiceAnimationDuration = Duration(milliseconds: 300);
  static const Duration bridgingDelay = Duration(seconds: 1);
  static const Duration readbackTimeout = Duration(seconds: 10);
  static const Duration presenceHeartbeat = Duration(minutes: 1);
  static const Duration presenceTtl = Duration(minutes: 5);

  // ─── Wave Settings ───
  static const double defaultRadiusKm = 2.5;
  static const double expandedRadiusKm = 5.0;
  static const int maxWave1Recipients = 8;
  static const int maxWave2Recipients = 15;

  // ─── Anti-Nuisance ───
  static const int maxDailyNotifications = 3;
  static const int minResponsesToStop = 2;
  static const int silenceDownWeightThreshold = 3;
  static const int maxEmergencyPerWeek = 1;

  // ─── Professional ───
  static const int maxVideoDurationSeconds = 15;
  static const int maxPostMediaCount = 5;
  static const int maxPostDescriptionLength = 500;

  // ─── Subscription Plans ───
  static const int monthlyPrice = 150000;
  static const int quarterlyPrice = 400000;
  static const int annualPrice = 1400000;
  static const int monthlyDurationDays = 30;
  static const int quarterlyDurationDays = 90;
  static const int annualDurationDays = 365;

  // ─── Quiet Hours (Iran UTC+3:30) ───
  static const int quietHourStart = 22; // 22:00
  static const int quietHourEnd = 8;    // 08:00

  // ─── Memory ───
  static const double minConfidence = 0.5;
  static const double temporalDecayLambda = 0.001;
  static const int maxOpenDemands = 10;
  static const int demandTtlDays = 7;

  // ─── Reverberation ───
  static const Duration reverberationUrgent = Duration(minutes: 15);
  static const Duration reverberationService = Duration(hours: 2);
  static const Duration reverberationSocial = Duration(hours: 6);

  // ─── UI ───
  static const double bottomSheetRadius = 24.0;
  static const double cardRadius = 16.0;
  static const double buttonRadius = 12.0;
  static const double avatarRadius = 24.0;
  static const int feedPageSize = 20;
}
