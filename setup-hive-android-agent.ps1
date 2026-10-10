param(
    [string]$RepoRoot = "C:\Projects\hive"
)

$ErrorActionPreference = "Stop"

$androidRoot = Join-Path $RepoRoot "apps\android-agent"
$appRoot = Join-Path $androidRoot "app"
$mainRoot = Join-Path $appRoot "src\main"
$kotlinRoot = Join-Path $mainRoot "java\com\blackbird\hiveagent"

if (-not (Test-Path $androidRoot)) {
    throw "Android project not found at: $androidRoot"
}

$backupRoot = Join-Path $androidRoot ("backup-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

function Backup-File {
    param([string]$Path)

    if (Test-Path $Path) {
        $relative = $Path.Substring($androidRoot.Length).TrimStart("\")
        $backupPath = Join-Path $backupRoot $relative
        $backupDirectory = Split-Path $backupPath -Parent

        New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
        Copy-Item $Path $backupPath -Force
    }
}

function Write-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    $directory = Split-Path $Path -Parent
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    Backup-File -Path $Path

    $Content | Set-Content -Path $Path -Encoding utf8
    Write-Host "Updated: $Path" -ForegroundColor Green
}

Write-Host "Creating Android agent structure..." -ForegroundColor Cyan

$directories = @(
    (Join-Path $kotlinRoot "api"),
    (Join-Path $kotlinRoot "commands"),
    (Join-Path $kotlinRoot "device"),
    (Join-Path $kotlinRoot "notifications"),
    (Join-Path $kotlinRoot "storage"),
    (Join-Path $kotlinRoot "ui"),
    (Join-Path $kotlinRoot "worker")
)

foreach ($directory in $directories) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}

Write-Utf8File -Path (Join-Path $appRoot "build.gradle.kts") -Content @'
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

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
            "\"http://10.0.2.2:8000/api/v1\"",
        )
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.15"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.compose.material3:material3:1.3.1")
    implementation("androidx.compose.ui:ui:1.7.6")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
}
'@

Write-Utf8File -Path (Join-Path $mainRoot "AndroidManifest.xml") -Content @'
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="false"
        android:label="Hive Agent"
        android:supportsRtl="true"
        android:theme="@style/Theme.HiveAgent"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".ui.MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "api\Models.kt") -Content @'
package com.blackbird.hiveagent.api

data class DeviceHeartbeatRequest(
    val batteryLevel: Int?,
    val isCharging: Boolean?,
    val wifiSsid: String?,
    val ipAddress: String?,
    val agentVersion: String?,
    val androidVersion: String?,
    val buildVersion: String?,
)

data class DeviceCommand(
    val id: String,
    val command: String,
    val payload: Map<String, Any?>,
    val createdAt: String,
)

data class DeviceHeartbeatResponse(
    val deviceId: String,
    val hiveId: String,
    val accepted: Boolean,
    val heartbeatIntervalSeconds: Int,
    val commands: List<DeviceCommand>,
)

data class CommandExecutionResult(
    val successful: Boolean,
    val message: String,
)
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "storage\AgentPreferences.kt") -Content @'
package com.blackbird.hiveagent.storage

import android.content.Context

class AgentPreferences(context: Context) {
    private val preferences = context.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    fun getDeviceToken(): String? =
        preferences
            .getString(KEY_DEVICE_TOKEN, null)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    fun saveDeviceToken(token: String) {
        preferences.edit()
            .putString(KEY_DEVICE_TOKEN, token.trim())
            .apply()
    }

    fun saveHeartbeatInterval(seconds: Int) {
        preferences.edit()
            .putInt(KEY_HEARTBEAT_INTERVAL, seconds)
            .apply()
    }

    companion object {
        private const val PREFERENCES_NAME = "hive_agent_preferences"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_HEARTBEAT_INTERVAL = "heartbeat_interval"
    }
}
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "device\DeviceInfoProvider.kt") -Content @'
package com.blackbird.hiveagent.device

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import com.blackbird.hiveagent.BuildConfig
import com.blackbird.hiveagent.api.DeviceHeartbeatRequest
import java.net.NetworkInterface
import java.util.Collections

class DeviceInfoProvider(
    private val context: Context,
) {
    fun createHeartbeatRequest(): DeviceHeartbeatRequest {
        val batteryIntent = context.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED),
        )

        val batteryLevel = batteryIntent
            ?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            ?.takeIf { it >= 0 }

        val batteryScale = batteryIntent
            ?.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            ?.takeIf { it > 0 }

        val batteryPercentage = if (
            batteryLevel != null &&
            batteryScale != null
        ) {
            ((batteryLevel.toFloat() / batteryScale.toFloat()) * 100)
                .toInt()
                .coerceIn(0, 100)
        } else {
            null
        }

        val batteryStatus = batteryIntent?.getIntExtra(
            BatteryManager.EXTRA_STATUS,
            -1,
        )

        val isCharging = when (batteryStatus) {
            BatteryManager.BATTERY_STATUS_CHARGING,
            BatteryManager.BATTERY_STATUS_FULL,
            -> true

            BatteryManager.BATTERY_STATUS_DISCHARGING,
            BatteryManager.BATTERY_STATUS_NOT_CHARGING,
            -> false

            else -> null
        }

        return DeviceHeartbeatRequest(
            batteryLevel = batteryPercentage,
            isCharging = isCharging,
            wifiSsid = null,
            ipAddress = findIpv4Address(),
            agentVersion = BuildConfig.VERSION_NAME,
            androidVersion = Build.VERSION.RELEASE,
            buildVersion = Build.DISPLAY,
        )
    }

    private fun findIpv4Address(): String? {
        return try {
            Collections.list(NetworkInterface.getNetworkInterfaces())
                .asSequence()
                .flatMap { networkInterface ->
                    Collections.list(networkInterface.inetAddresses)
                        .asSequence()
                }
                .firstOrNull { address ->
                    !address.isLoopbackAddress &&
                        address.hostAddress?.contains(":") == false
                }
                ?.hostAddress
        } catch (_: Exception) {
            null
        }
    }
}
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "api\HiveApiClient.kt") -Content @'
package com.blackbird.hiveagent.api

import com.blackbird.hiveagent.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class HiveApiException(
    message: String,
    val statusCode: Int? = null,
) : Exception(message)

class HiveApiClient(
    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/'),
) {
    suspend fun sendHeartbeat(
        deviceToken: String,
        payload: DeviceHeartbeatRequest,
    ): DeviceHeartbeatResponse {
        val body = JSONObject().apply {
            putNullable("battery_level", payload.batteryLevel)
            putNullable("is_charging", payload.isCharging)
            putNullable("wifi_ssid", payload.wifiSsid)
            putNullable("ip_address", payload.ipAddress)
            putNullable("agent_version", payload.agentVersion)
            putNullable("android_version", payload.androidVersion)
            putNullable("build_version", payload.buildVersion)
        }

        return parseHeartbeatResponse(
            post(
                path = "/device-agent/heartbeat",
                token = deviceToken,
                body = body,
            ),
        )
    }

    suspend fun acknowledgeCommand(
        deviceToken: String,
        commandId: String,
    ) {
        post(
            path = "/device-commands/$commandId/acknowledge",
            token = deviceToken,
            body = null,
        )
    }

    suspend fun completeCommand(
        deviceToken: String,
        commandId: String,
        resultMessage: String,
    ) {
        post(
            path = "/device-commands/$commandId/complete",
            token = deviceToken,
            body = JSONObject().put(
                "result_message",
                resultMessage,
            ),
        )
    }

    suspend fun failCommand(
        deviceToken: String,
        commandId: String,
        resultMessage: String,
    ) {
        post(
            path = "/device-commands/$commandId/fail",
            token = deviceToken,
            body = JSONObject().put(
                "result_message",
                resultMessage,
            ),
        )
    }

    private suspend fun post(
        path: String,
        token: String,
        body: JSONObject?,
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL("$baseUrl$path")
            .openConnection() as HttpURLConnection

        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty(
                "Authorization",
                "Bearer $token",
            )
            connection.setRequestProperty(
                "Accept",
                "application/json",
            )

            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty(
                    "Content-Type",
                    "application/json",
                )

                connection.outputStream.bufferedWriter().use {
                    it.write(body.toString())
                }
            }

            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            val responseText = stream
                ?.bufferedReader()
                ?.use { it.readText() }
                .orEmpty()

            if (statusCode !in 200..299) {
                throw HiveApiException(
                    message = "Hive API returned HTTP $statusCode: $responseText",
                    statusCode = statusCode,
                )
            }

            if (responseText.isBlank()) {
                JSONObject()
            } else {
                JSONObject(responseText)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseHeartbeatResponse(
        json: JSONObject,
    ): DeviceHeartbeatResponse {
        val commandsJson = json.optJSONArray("commands") ?: JSONArray()

        val commands = buildList {
            for (index in 0 until commandsJson.length()) {
                val commandJson = commandsJson.getJSONObject(index)

                add(
                    DeviceCommand(
                        id = commandJson.getString("id"),
                        command = commandJson.getString("command"),
                        payload = parsePayload(
                            commandJson.optJSONObject("payload"),
                        ),
                        createdAt = commandJson.getString("created_at"),
                    ),
                )
            }
        }

        return DeviceHeartbeatResponse(
            deviceId = json.getString("device_id"),
            hiveId = json.getString("hive_id"),
            accepted = json.optBoolean("accepted", true),
            heartbeatIntervalSeconds = json.optInt(
                "heartbeat_interval_seconds",
                300,
            ),
            commands = commands,
        )
    }

    private fun parsePayload(
        json: JSONObject?,
    ): Map<String, Any?> {
        if (json == null) {
            return emptyMap()
        }

        return buildMap {
            val keys = json.keys()

            while (keys.hasNext()) {
                val key = keys.next()
                val value = json.opt(key)
                put(key, if (value == JSONObject.NULL) null else value)
            }
        }
    }

    private fun JSONObject.putNullable(
        key: String,
        value: Any?,
    ) {
        put(key, value ?: JSONObject.NULL)
    }
}
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "notifications\NotificationHelper.kt") -Content @'
package com.blackbird.hiveagent.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class NotificationHelper(
    private val context: Context,
) {
    fun showMessage(
        title: String,
        message: String,
    ): Boolean {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }

        createChannel()

        val manager = context.getSystemService(
            Context.NOTIFICATION_SERVICE,
        ) as NotificationManager

        val notification = NotificationCompat.Builder(
            context,
            CHANNEL_ID,
        )
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setStyle(
                NotificationCompat.BigTextStyle().bigText(message),
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify(
            System.currentTimeMillis().toInt(),
            notification,
        )

        return true
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val channel = NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Messages sent from the Hive management console"
        }

        val manager = context.getSystemService(
            Context.NOTIFICATION_SERVICE,
        ) as NotificationManager

        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "hive_remote_messages"
        private const val CHANNEL_NAME = "Hive remote messages"
    }
}
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "commands\CommandProcessor.kt") -Content @'
package com.blackbird.hiveagent.commands

import android.content.Context
import com.blackbird.hiveagent.api.CommandExecutionResult
import com.blackbird.hiveagent.api.DeviceCommand
import com.blackbird.hiveagent.notifications.NotificationHelper

class CommandProcessor(
    context: Context,
) {
    private val notificationHelper = NotificationHelper(context)

    suspend fun execute(
        command: DeviceCommand,
    ): CommandExecutionResult {
        return when (command.command.uppercase()) {
           "REQUEST_LOCATION" -> executeRequestLocation(command)
            "SYNC" -> success("Device synchronisation completed.")
            "PING" -> success("Pong received from Hive Agent.")
            "SHOW_MESSAGE" -> executeShowMessage(command)
            "LOCK_DEVICE" -> failure(
                "LOCK_DEVICE requires Android device-owner or device-admin provisioning.",
            )

            else -> failure(
                "Unsupported command: ${command.command}",
            )
        }
    }

    private fun executeShowMessage(
        command: DeviceCommand,
    ): CommandExecutionResult {
        val title = command.payload["title"]
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: "Hive message"

        val message = command.payload["message"]
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: return failure(
                "SHOW_MESSAGE payload did not contain a message.",
            )

        return if (
            notificationHelper.showMessage(
                title = title,
                message = message,
            )
        ) {
            success("Message displayed successfully.")
        } else {
            failure("Notification permission has not been granted.")
        }
    }

    private fun success(message: String) =
        CommandExecutionResult(
            successful = true,
            message = message,
        )

    private fun failure(message: String) =
        CommandExecutionResult(
            successful = false,
            message = message,
        )
}
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "worker\HeartbeatWorker.kt") -Content @'
package com.blackbird.hiveagent.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import com.blackbird.hiveagent.api.HiveApiClient
import com.blackbird.hiveagent.commands.CommandProcessor
import com.blackbird.hiveagent.device.DeviceInfoProvider
import com.blackbird.hiveagent.storage.AgentPreferences

class HeartbeatWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {
    private val preferences = AgentPreferences(appContext)
    private val deviceInfoProvider = DeviceInfoProvider(appContext)
    private val apiClient = HiveApiClient()
    private val commandProcessor = CommandProcessor(appContext)

    override suspend fun doWork(): Result {
        val deviceToken = preferences.getDeviceToken()
            ?: return Result.failure(
                outputData("The device has not been enrolled."),
            )

        return try {
            val heartbeat = apiClient.sendHeartbeat(
                deviceToken = deviceToken,
                payload = deviceInfoProvider.createHeartbeatRequest(),
            )

            preferences.saveHeartbeatInterval(
                heartbeat.heartbeatIntervalSeconds,
            )

            var completedCommands = 0
            var failedCommands = 0

            for (command in heartbeat.commands) {
                try {
                    apiClient.acknowledgeCommand(
                        deviceToken = deviceToken,
                        commandId = command.id,
                    )

                    val commandResult = commandProcessor.execute(command)

                    if (commandResult.successful) {
                        apiClient.completeCommand(
                            deviceToken = deviceToken,
                            commandId = command.id,
                            resultMessage = commandResult.message,
                        )
                        completedCommands += 1
                    } else {
                        apiClient.failCommand(
                            deviceToken = deviceToken,
                            commandId = command.id,
                            resultMessage = commandResult.message,
                        )
                        failedCommands += 1
                    }
                } catch (error: Exception) {
                    failedCommands += 1

                    runCatching {
                        apiClient.failCommand(
                            deviceToken = deviceToken,
                            commandId = command.id,
                            resultMessage = error.message
                                ?: "Command execution failed.",
                        )
                    }
                }
            }

            Result.success(
                outputData(
                    "Heartbeat accepted. " +
                        "$completedCommands command(s) completed and " +
                        "$failedCommands command(s) failed.",
                ),
            )
        } catch (error: Exception) {
            Result.failure(
                outputData(
                    error.message ?: "Heartbeat failed.",
                ),
            )
        }
    }

    private fun outputData(message: String): Data =
        Data.Builder()
            .putString(OUTPUT_MESSAGE, message)
            .build()

    companion object {
        const val OUTPUT_MESSAGE = "heartbeat_result"
    }
}
'@

Write-Utf8File -Path (Join-Path $kotlinRoot "ui\MainActivity.kt") -Content @'
package com.blackbird.hiveagent.ui

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Observer
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.blackbird.hiveagent.BuildConfig
import com.blackbird.hiveagent.storage.AgentPreferences
import com.blackbird.hiveagent.worker.HeartbeatWorker

class MainActivity : ComponentActivity() {
    private val notificationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationPermissionLauncher.launch(
                Manifest.permission.POST_NOTIFICATIONS,
            )
        }

        setContent {
            HiveAgentApp()
        }
    }
}

@Composable
fun HiveAgentApp() {
    val context = LocalContext.current
    val activity = context as ComponentActivity
    val preferences = remember {
        AgentPreferences(context)
    }

    var deviceToken by remember {
        mutableStateOf(
            preferences.getDeviceToken().orEmpty(),
        )
    }

    var statusMessage by remember {
        mutableStateOf("Ready")
    }

    MaterialTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = "Hive Agent",
                    style = MaterialTheme.typography.headlineMedium,
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text("Android device management agent")

                Spacer(modifier = Modifier.height(24.dp))

                OutlinedTextField(
                    value = deviceToken,
                    onValueChange = {
                        deviceToken = it
                    },
                    modifier = Modifier.fillMaxWidth(),
                    label = {
                        Text("Device token")
                    },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                )

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val cleanedToken = deviceToken.trim()

                        if (cleanedToken.isEmpty()) {
                            statusMessage =
                                "Enter the enrolled device token."
                            return@Button
                        }

                        preferences.saveDeviceToken(cleanedToken)
                        statusMessage = "Heartbeat queued..."

                        val request =
                            OneTimeWorkRequestBuilder<HeartbeatWorker>()
                                .build()

                        val workManager =
                            WorkManager.getInstance(context)

                        val observer = object : Observer<WorkInfo> {
                            override fun onChanged(workInfo: WorkInfo) {
                                statusMessage = when (workInfo.state) {
                                    WorkInfo.State.ENQUEUED ->
                                        "Heartbeat queued..."

                                    WorkInfo.State.RUNNING ->
                                        "Contacting Hive..."

                                    WorkInfo.State.SUCCEEDED ->
                                        workInfo.outputData.getString(
                                            HeartbeatWorker.OUTPUT_MESSAGE,
                                        ) ?: "Heartbeat completed."

                                    WorkInfo.State.FAILED ->
                                        workInfo.outputData.getString(
                                            HeartbeatWorker.OUTPUT_MESSAGE,
                                        ) ?: "Heartbeat failed."

                                    WorkInfo.State.BLOCKED ->
                                        "Heartbeat blocked."

                                    WorkInfo.State.CANCELLED ->
                                        "Heartbeat cancelled."
                                }

                                if (workInfo.state.isFinished) {
                                    workManager
                                        .getWorkInfoByIdLiveData(request.id)
                                        .removeObserver(this)
                                }
                            }
                        }

                        workManager
                            .getWorkInfoByIdLiveData(request.id)
                            .observe(activity, observer)

                        workManager.enqueue(request)
                    },
                ) {
                    Text("Save token and run heartbeat")
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "API: ${BuildConfig.API_BASE_URL}",
                    style = MaterialTheme.typography.bodySmall,
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(statusMessage)
            }
        }
    }
}
'@

Write-Host ""
Write-Host "Android agent files created successfully." -ForegroundColor Green
Write-Host "Backups saved to: $backupRoot" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now run:" -ForegroundColor Cyan
Write-Host "cd `"$androidRoot`""
Write-Host ".\gradlew.bat clean assembleDebug"
