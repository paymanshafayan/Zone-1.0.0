# Zone App ProGuard Rules

# ─── Flutter ───
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.** { *; }

# ─── Riverpod ───
-keep class * extends flutter_riverpod.** { *; }

# ─── WebSocket ───
-keep class com.zone.zoneapp.** { *; }

# ─── Media3 / ExoPlayer (just_audio playback engine) ───
# Media3 ships consumer ProGuard rules, but keep the error classes that
# are referenced reflectively and silence the legacy exoplayer2 warnings.
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**
-dontwarn com.google.android.exoplayer2.**

# ─── just_audio / audio_session (ryanheise plugins) ───
-keep class com.ryanheise.** { *; }
-dontwarn com.ryanheise.**

# ─── record (microphone capture) ───
-dontwarn com.llfbandit.**

# ─── speech_to_text / flutter_tts ───
-keep class com.csdcorp.speech_to_text.** { *; }
-dontwarn com.csdcorp.**
-keep class com.tundralabs.fluttertts.** { *; }
-dontwarn com.tundralabs.**

# ─── ONNX Runtime (when enabled) ───
-keep class ai.onnxruntime.** { *; }

# ─── Persian Text ───
-dontwarn java.text.**
