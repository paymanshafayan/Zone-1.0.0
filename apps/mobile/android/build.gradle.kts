allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

// ─── Flutter convention: build outputs land in <flutter-project>/build ───
// Without this (standard template block), each module keeps its AGP-native
// buildDir (android/app/build), while `flutter build apk` expects the APK
// at <flutter-project>/build/app/outputs/flutter-apk — which silently fails
// the CI build with "Gradle build failed to produce an .apk file".
val newBuildDir: Directory = rootProject.layout.buildDirectory.dir("../../build").get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
