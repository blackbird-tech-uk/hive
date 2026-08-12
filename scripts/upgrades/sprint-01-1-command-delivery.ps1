param(
    [ValidateSet("Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 01.1 - Automatic Command Delivery"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$MainActivityPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\MainActivity.kt"
$ManifestPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\AndroidManifest.xml"
$ServiceDir = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\service"
$ServicePath = Join-Path $ServiceDir "CommandPollingService.kt"

function Assert-File {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
}

function Replace-Exact {
    param(
        [string]$Content,
        [string]$Old,
        [string]$New,
        [string]$Label
    )

    if (-not $Content.Contains($Old)) {
        throw "Could not find expected block: $Label"
    }

    return $Content.Replace($Old, $New)
}

function Apply-Upgrade {
    Assert-File $MainActivityPath
    Assert-File $ManifestPath

    New-Item -ItemType Directory -Path $ServiceDir -Force | Out-Null

    # ---------------------------------------------------------
    # CommandPollingService.kt
    # Uses the existing heartbeat endpoint because it already
    # authenticates the device and returns pending commands.
    # ---------------------------------------------------------
    @'
package com.blackbird.hiveagent.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import com.blackbird.hiveagent.api.HiveApiClient
import com.blackbird.hiveagent.commands.CommandProcessor
import com.blackbird.hiveagent.data.local.TokenStorage
import com.blackbird.hiveagent.device.DeviceInfoProvider
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class CommandPollingService : Service() {

    private val serviceJob: Job = SupervisorJob()
    private val serviceScope =
        CoroutineScope(serviceJob + Dispatchers.IO)

    private lateinit var tokenStorage: TokenStorage
    private lateinit var apiClient: HiveApiClient
    private lateinit var deviceInfoProvider: DeviceInfoProvider
    private lateinit var commandProcessor: CommandProcessor

    override fun onCreate() {
        super.onCreate()

        tokenStorage = TokenStorage(applicationContext)
        apiClient = HiveApiClient()
        deviceInfoProvider =
            DeviceInfoProvider(applicationContext)
        commandProcessor = CommandProcessor(
            context = applicationContext,
            apiClient = apiClient,
        )

        createNotificationChannel()

        startForeground(
            FOREGROUND_NOTIFICATION_ID,
            createForegroundNotification(),
        )

        serviceScope.launch {
            pollLoop()
        }
    }

    override fun onDestroy() {
        serviceJob.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private suspend fun pollLoop() {
        while (serviceScope.isActive) {
            try {
                pollOnce()
            } catch (error: CancellationException) {
                throw error
            } catch (error: Exception) {
                Log.e(
                    LOG_TAG,
                    "Command poll failed",
                    error,
                )
            }

            delay(POLL_INTERVAL_MS)
        }
    }

    private suspend fun pollOnce() {
        val deviceToken = tokenStorage.deviceToken
            .first()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: run {
                Log.d(
                    LOG_TAG,
                    "No device token. Stopping command poller.",
                )
                stopSelf()
                return
            }

        val heartbeat =
            apiClient.sendHeartbeat(
                deviceToken = deviceToken,
                payload =
                    deviceInfoProvider
                        .createHeartbeatRequest(),
            )

        if (heartbeat.commands.isEmpty()) {
            return
        }

        Log.d(
            LOG_TAG,
            "Received ${heartbeat.commands.size} command(s)",
        )

        for (command in heartbeat.commands) {
            try {
                apiClient.acknowledgeCommand(
                    deviceToken = deviceToken,
                    commandId = command.id,
                )

                val result =
                    commandProcessor.execute(
                        command = command,
                        deviceToken = deviceToken,
                    )

                if (result.successful) {
                    apiClient.completeCommand(
                        deviceToken = deviceToken,
                        commandId = command.id,
                        resultMessage = result.message,
                    )
                } else {
                    apiClient.failCommand(
                        deviceToken = deviceToken,
                        commandId = command.id,
                        resultMessage = result.message,
                    )
                }
            } catch (error: Exception) {
                Log.e(
                    LOG_TAG,
                    "Command ${command.id} failed",
                    error,
                )

                runCatching {
                    apiClient.failCommand(
                        deviceToken = deviceToken,
                        commandId = command.id,
                        resultMessage =
                            error.message
                                ?: "Command execution failed.",
                    )
                }
            }
        }
    }

    private fun createForegroundNotification():
        Notification {
        return NotificationCompat.Builder(
            this,
            CHANNEL_ID,
        )
            .setSmallIcon(
                android.R.drawable.stat_notify_sync,
            )
            .setContentTitle("Hive Agent")
            .setContentText(
                "Connected to Hive for remote commands",
            )
            .setOngoing(true)
            .setPriority(
                NotificationCompat.PRIORITY_LOW,
            )
            .build()
    }

    private fun createNotificationChannel() {
        if (
            Build.VERSION.SDK_INT <
                Build.VERSION_CODES.O
        ) {
            return
        }

        val manager =
            getSystemService(
                NOTIFICATION_SERVICE,
            ) as NotificationManager

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Hive Agent connection",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description =
                    "Keeps the enrolled device connected to Hive."
            },
        )
    }

    companion object {
        private const val LOG_TAG =
            "HiveCommandPolling"

        private const val CHANNEL_ID =
            "hive_command_polling"

        private const val FOREGROUND_NOTIFICATION_ID =
            1001

        private const val POLL_INTERVAL_MS =
            10_000L
    }
}
'@ | Set-Content -Path $ServicePath -Encoding UTF8

    # ---------------------------------------------------------
    # AndroidManifest.xml
    # ---------------------------------------------------------
    $manifest = (
        Get-Content $ManifestPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $manifest.Contains(
            'android.permission.FOREGROUND_SERVICE'
        )
    ) {
        $manifest = $manifest.Replace(
            '<uses-permission' + "`n" +
            '        android:name="android.permission.INTERNET" />',
            '<uses-permission' + "`n" +
            '        android:name="android.permission.INTERNET" />' + "`n`n" +
            '    <uses-permission' + "`n" +
            '        android:name="android.permission.FOREGROUND_SERVICE" />' + "`n`n" +
            '    <uses-permission' + "`n" +
            '        android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />'
        )
    }

    if (
        -not $manifest.Contains(
            'android:name=".service.CommandPollingService"'
        )
    ) {
        $serviceBlock = @'

        <service
            android:name=".service.CommandPollingService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />
'@

        $manifest = $manifest.Replace(
            '        <activity' + "`n" +
            '            android:name=".MainActivity"',
            $serviceBlock + "`n" +
            '        <activity' + "`n" +
            '            android:name=".MainActivity"'
        )
    }

    Set-Content `
        -Path $ManifestPath `
        -Value $manifest `
        -Encoding UTF8

    # ---------------------------------------------------------
    # MainActivity.kt
    # - request notification permission on Android 13+
    # - start command polling when enrolled
    # - stop command polling when not enrolled
    # ---------------------------------------------------------
    $main = (
        Get-Content $MainActivityPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $main.Contains(
            'import android.content.Intent'
        )
    ) {
        $main = $main.Replace(
            'import android.content.pm.PackageManager',
            'import android.content.Intent' + "`n" +
            'import android.content.pm.PackageManager'
        )
    }

    if (
        -not $main.Contains(
            'import android.os.Build'
        )
    ) {
        $main = $main.Replace(
            'import android.os.Bundle',
            'import android.os.Build' + "`n" +
            'import android.os.Bundle'
        )
    }

    if (
        -not $main.Contains(
            'import androidx.core.content.ContextCompat.startForegroundService'
        )
    ) {
        $main = $main.Replace(
            'import androidx.core.content.ContextCompat',
            'import androidx.core.content.ContextCompat' + "`n" +
            'import androidx.core.content.ContextCompat.startForegroundService'
        )
    }

    if (
        -not $main.Contains(
            'import com.blackbird.hiveagent.service.CommandPollingService'
        )
    ) {
        $main = $main.Replace(
            'import com.blackbird.hiveagent.ui.theme.HiveAgentTheme',
            'import com.blackbird.hiveagent.service.CommandPollingService' + "`n" +
            'import com.blackbird.hiveagent.ui.theme.HiveAgentTheme'
        )
    }

    $locationLauncher = @'
    val locationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts
                .RequestPermission(),
        ) { }
'@

    $permissionLaunchers = @'
    val locationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts
                .RequestPermission(),
        ) { }

    val notificationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts
                .RequestPermission(),
        ) { }
'@

    if (
        -not $main.Contains(
            'val notificationPermissionLauncher ='
        )
    ) {
        $main = Replace-Exact `
            -Content $main `
            -Old $locationLauncher `
            -New $permissionLaunchers `
            -Label "permission launcher"
    }

    $loadEffect = @'
    LaunchedEffect(Unit) {
        hiveViewModel.loadDevice()
    }
'@

    $newEffects = @'
    LaunchedEffect(Unit) {
        if (
            Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(
                Manifest.permission.POST_NOTIFICATIONS,
            )
        }
    }

    LaunchedEffect(Unit) {
        hiveViewModel.loadDevice()
    }

    LaunchedEffect(uiState.isEnrolled) {
        val serviceIntent = Intent(
            context,
            CommandPollingService::class.java,
        )

        if (uiState.isEnrolled) {
            startForegroundService(
                context,
                serviceIntent,
            )
        } else {
            context.stopService(serviceIntent)
        }
    }
'@

    if (
        -not $main.Contains(
            'CommandPollingService::class.java'
        )
    ) {
        $main = Replace-Exact `
            -Content $main `
            -Old $loadEffect `
            -New $newEffects `
            -Label "polling service lifecycle"
    }

    Set-Content `
        -Path $MainActivityPath `
        -Value $main `
        -Encoding UTF8

    Write-Host ""
    Write-Host "$SprintName applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "Added:"
    Write-Host "  - 10-second automatic command polling"
    Write-Host "  - Foreground Hive connection service"
    Write-Host "  - Android 13+ notification permission prompt"
    Write-Host "  - Service start/stop based on enrolment"
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  .\scripts\upgrades\sprint-01-1-command-delivery.ps1 -Mode Validate"
}

function Validate-Upgrade {
    Assert-File $MainActivityPath
    Assert-File $ManifestPath
    Assert-File $ServicePath

    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Yellow

    $manifest = Get-Content $ManifestPath -Raw
    $main = Get-Content $MainActivityPath -Raw
    $service = Get-Content $ServicePath -Raw

    $checks = @(
        @(
            $manifest.Contains("FOREGROUND_SERVICE"),
            "Foreground service permission"
        ),
        @(
            $manifest.Contains("CommandPollingService"),
            "Command polling service registration"
        ),
        @(
            $main.Contains("POST_NOTIFICATIONS"),
            "Notification permission request"
        ),
        @(
            $main.Contains("CommandPollingService::class.java"),
            "Command service lifecycle"
        ),
        @(
            $service.Contains("POLL_INTERVAL_MS"),
            "10-second polling service"
        ),
        @(
            $service.Contains("acknowledgeCommand"),
            "Command acknowledgement"
        ),
        @(
            $service.Contains("completeCommand"),
            "Command completion"
        )
    )

    foreach ($check in $checks) {
        if (-not $check[0]) {
            throw "Validation failed: $($check[1])"
        }

        Write-Host "  PASS - $($check[1])" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "Building Android debug APK..." -ForegroundColor Cyan

    Push-Location (
        Join-Path $RepoRoot "apps\android-agent"
    )

    try {
        .\gradlew.bat :app:assembleDebug

        if ($LASTEXITCODE -ne 0) {
            throw "Android build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "Sprint 01.1 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "APK:"
    Write-Host "  apps\android-agent\app\build\outputs\apk\debug\app-debug.apk"
}

switch ($Mode) {
    "Apply" {
        Apply-Upgrade
    }

    "Validate" {
        Validate-Upgrade
    }
}
