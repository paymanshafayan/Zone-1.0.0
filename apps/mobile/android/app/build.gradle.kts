plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.zone.zoneapp"
    compileSdk = flutter.compileSdkVersion
    // Highest NDK required by this project's plugins. AGP resolves NDK
    // conflicts by using the highest requested version (NDK releases are
    // backward compatible), and this exact release is preinstalled on the
    // GitHub runner images.
    ndkVersion = "28.2.13676358"

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.zone.zoneapp"
        minSdk = 24 // Android 7.0+ — required for ONNX Runtime + WebSocket
        targetSdk = flutter.targetSdkVersion
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
            isMinifyEnabled = true
            isShrinkResources = true
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

// ─── TEMPORARY CI DIAGNOSTICS ───
// Flutter's `flutter build apk` succeeds but cannot find the release APK.
// Log the effective build dirs and every produced APK (logger.error prints
// even under gradle -q) so CI logs reveal the divergence.
afterEvaluate {
    tasks.findByName("assembleRelease")?.doLast {
        logger.error("ZONE-CI app.buildDir=${layout.buildDirectory.get().asFile.absolutePath}")
        logger.error("ZONE-CI root.buildDir=${rootProject.layout.buildDirectory.get().asFile.absolutePath}")
        val apks = fileTree(layout.buildDirectory.get()) { include("**/*.apk") }
        if (apks.isEmpty) {
            logger.error("ZONE-CI NO-APK under app buildDir")
        } else {
            apks.forEach { logger.error("ZONE-CI APK: ${it.absolutePath}") }
        }
    }
}
