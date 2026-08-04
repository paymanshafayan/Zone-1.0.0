/// Environment Configuration — Dev / Staging / Production
///
/// Iranian services:
///   - Neshan Maps (نشان): neighbourhood map display
///   - Chabok (چابک): push notifications (replaces Firebase)
///   - Avanegar (آوانگار): Persian STT/TTS
///   - Arvan Cloud (ابر آروان): S3-compatible object storage
library core_constants_environment;

class Environment {
  Environment._();

  static const String _env = String.fromEnvironment('ENV', defaultValue: 'development');
  static bool get isDevelopment => _env == 'development';
  static bool get isStaging => _env == 'staging';
  static bool get isProduction => _env == 'production';

  // ─── API URLs ───
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
  static const String wsBaseUrl = String.fromEnvironment(
    'WS_BASE_URL',
    defaultValue: 'ws://10.0.2.2:3001',
  );

  // ─── Iranian Service URLs ───
  static const String avanegarBaseUrl = String.fromEnvironment(
    'AVANEGAR_BASE_URL',
    defaultValue: 'https://api.avanegar.com/v1',
  );
  static const String avanegarWsUrl = String.fromEnvironment(
    'AVANEGAR_WS_URL',
    defaultValue: 'wss://api.avanegar.com/v1/ws',
  );
  static const String arvanEndPoint = String.fromEnvironment(
    'ARVAN_ENDPOINT',
    defaultValue: 's3.ir-central-1.arvanstorage.com',
  );
  static const String arvanBucket = String.fromEnvironment(
    'ARVAN_BUCKET',
    defaultValue: 'zone-media',
  );

  // ─── Feature Flags ───
  static const bool enableVoiceRecording = bool.fromEnvironment(
    'ENABLE_VOICE_RECORDING',
    defaultValue: false,
  );
  static const bool enableTTS = bool.fromEnvironment(
    'ENABLE_TTS',
    defaultValue: false,
  );
  static const bool useAvanegarSTT = bool.fromEnvironment(
    'USE_AVANEGAR_STT',
    defaultValue: false,
  );
  static const bool useAvanegarTTS = bool.fromEnvironment(
    'USE_AVANEGAR_TTS',
    defaultValue: false,
  );
  static const bool enableOnnxModels = bool.fromEnvironment(
    'ENABLE_ONNX',
    defaultValue: false,
  );
  static const bool enableNeshanMap = bool.fromEnvironment(
    'ENABLE_NESHAN_MAP',
    defaultValue: false,
  );
  static const bool enablePushNotifications = bool.fromEnvironment(
    'ENABLE_PUSH_NOTIFICATIONS',
    defaultValue: false,
  );
  static const bool useArvanStorage = bool.fromEnvironment(
    'USE_ARVAN_STORAGE',
    defaultValue: false,
  );
  static const bool enableAnalytics = bool.fromEnvironment(
    'ENABLE_ANALYTICS',
    defaultValue: false,
  );
  static const bool enableCrashReporting = bool.fromEnvironment(
    'ENABLE_CRASH_REPORTING',
    defaultValue: false,
  );

  // ─── Timeouts ───
  static const Duration apiTimeout = Duration(
    seconds: int.fromEnvironment('API_TIMEOUT_SECONDS', defaultValue: 10),
  );
  static const Duration wsReconnectDelay = Duration(
    seconds: int.fromEnvironment('WS_RECONNECT_SECONDS', defaultValue: 5),
  );

  // ─── Debug ───
  static const bool enableDebugLogging = bool.fromEnvironment(
    'ENABLE_DEBUG_LOGGING',
    defaultValue: true,
  );
  static const bool showPerformanceOverlay = bool.fromEnvironment(
    'SHOW_PERFORMANCE_OVERLAY',
    defaultValue: false,
  );
}
