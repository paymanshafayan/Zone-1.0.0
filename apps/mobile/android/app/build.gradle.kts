plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.zone.zoneapp"
    // Pinned to the API level provisioned in CI (ANDROID_API_LEVEL=34) instead
    // of flutter.compileSdkVersion/targetSdkVersion — resolution of those
    // against the GitHub runner image was part of the release-build failure.
    compileSdk = 34
    // Pinned to an NDK that is preinstalled on the GitHub runner images.
    // flutter.ndkVersion resolves to a patch release that is not present
    // on the runners, which fails release builds at stripReleaseDebugSymbols.
    ndkVersion = "27.2.12479018"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.zone.zoneapp"
        minSdk = 24 // Android 7.0+ — required for ONNX Runtime + WebSocket
        targetSdk = 34
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        // Support for RTL languages
        multiDexEnabled = true
    }

    buildTypes {
        debug {
            isDebuggable = true
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
            resValue("string", "app_name", "زون (Debug)")
        }
        release {
            // DIAGNOSTIC: minification temporarily disabled to isolate a
            // persistent CI release-build failure (re-enable once fixed).
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            resValue("string", "app_name", "زون")
            // TODO: Add production signing config
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    // Support for RTL
    buildFeatures {
        viewBinding = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
