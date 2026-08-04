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

# ─── ONNX Runtime (when enabled) ───
-keep class ai.onnxruntime.** { *; }

# ─── Persian Text ───
-dontwarn java.text.**
