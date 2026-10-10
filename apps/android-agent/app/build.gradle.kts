import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
}

val hiveApiBaseUrl =
    providers.gradleProperty("hiveApiBaseUrl")
        .orElse(providers.environmentVariable("HIVE_API_BASE_URL"))
        .orElse("http://10.0.2.2:8000/api/v1")
        .get()

android {
    namespace = "com.blackbird.hiveagent"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.blackbird.hiveagent"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"$hiveApiBaseUrl\"",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility =
            JavaVersion.VERSION_17
        targetCompatibility =
            JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(
        libs.androidx.lifecycle.runtime.ktx,
    )
    implementation(
        libs.androidx.lifecycle.viewmodel.compose,
    )
    implementation(
        libs.androidx.activity.compose,
    )

    implementation(
        platform(libs.androidx.compose.bom),
    )
    implementation(libs.androidx.compose.ui)
    implementation(
        libs.androidx.compose.ui.graphics,
    )
    implementation(
        libs.androidx.compose.ui.tooling.preview,
    )
    implementation(
        libs.androidx.compose.material3,
    )

    implementation(
        libs.androidx.datastore.preferences,
    )
    implementation(
        libs.androidx.work.runtime.ktx,
    )

    implementation(
        "androidx.camera:camera-core:1.4.2",
    )
    implementation(
        "androidx.camera:camera-camera2:1.4.2",
    )
    implementation(
        "androidx.camera:camera-lifecycle:1.4.2",
    )
    implementation(
        "androidx.camera:camera-view:1.4.2",
    )

    implementation(
        "com.google.mlkit:barcode-scanning:17.3.0",
    )

    implementation(libs.retrofit.core)
    implementation(
        libs.retrofit.converter.gson,
    )

    implementation(libs.okhttp.core)
    implementation(libs.okhttp.logging)

    debugImplementation(
        libs.androidx.compose.ui.tooling,
    )
    debugImplementation(
        libs.androidx.compose.ui.test.manifest,
    )

    testImplementation(libs.junit)

    androidTestImplementation(
        libs.androidx.junit,
    )
    androidTestImplementation(
        libs.androidx.espresso.core,
    )
    androidTestImplementation(
        platform(libs.androidx.compose.bom),
    )
    androidTestImplementation(
        libs.androidx.compose.ui.test.junit4,
    )
}
