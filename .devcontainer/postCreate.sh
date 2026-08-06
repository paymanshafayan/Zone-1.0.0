#!/usr/bin/env bash
set -euo pipefail

echo "==> Accepting Android SDK licenses"
yes | sdkmanager --licenses > /dev/null || true

echo "==> Installing platform-tools, android-34, build-tools 34.0.0 (same as CI)"
sdkmanager --install "platform-tools" "platforms;android-34" "build-tools;34.0.0"

echo "==> flutter doctor"
flutter doctor -v

echo "==> flutter pub get (apps/mobile)"
cd apps/mobile
flutter pub get

echo "==> Done. Try: cd apps/mobile && flutter build apk --release -v"
