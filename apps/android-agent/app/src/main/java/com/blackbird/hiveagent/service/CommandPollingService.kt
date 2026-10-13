package com.blackbird.hiveagent.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.CancellationSignal
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.blackbird.hiveagent.api.DeviceLocationUpload
import com.blackbird.hiveagent.api.HiveApiClient
import com.blackbird.hiveagent.commands.CommandProcessor
import com.blackbird.hiveagent.data.local.TokenStorage
import com.blackbird.hiveagent.device.DeviceInfoProvider
import com.blackbird.hiveagent.storage.TelemetryQueue
import com.blackbird.hiveagent.scan.ScanActivityObserver
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.time.Instant
import kotlin.coroutines.resume

class CommandPollingService : Service() {

    private val serviceJob: Job = SupervisorJob()
    private val serviceScope =
        CoroutineScope(serviceJob + Dispatchers.IO)

    private lateinit var tokenStorage: TokenStorage
    private lateinit var apiClient: HiveApiClient
    private lateinit var deviceInfoProvider: DeviceInfoProvider
    private lateinit var commandProcessor: CommandProcessor
    private lateinit var locationManager: LocationManager
    private lateinit var telemetryQueue: TelemetryQueue
    private var lastLocationUploadAt = 0L
    private var scanObserver: ScanActivityObserver? = null

    override fun onCreate() {
        super.onCreate()

        tokenStorage = TokenStorage(applicationContext)
        apiClient = HiveApiClient()
        deviceInfoProvider =
            DeviceInfoProvider(applicationContext)
        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        telemetryQueue = TelemetryQueue(applicationContext)
        // Safety gate: disabled until EA660/LiveScan coexistence is verified.
        if (ENABLE_SCAN_OBSERVER_PROBE) {
            scanObserver = ScanActivityObserver(applicationContext).also { it.start() }
        }
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
        scanObserver?.stop()
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

        flushQueuedLocations(deviceToken)
        uploadLatestLocationIfDue(deviceToken)

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


    private suspend fun uploadLatestLocationIfDue(deviceToken: String) {
        val now = System.currentTimeMillis()
        if (now - lastLocationUploadAt < LOCATION_UPLOAD_INTERVAL_MS) return

        val fineGranted = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_FINE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        val coarseGranted = ContextCompat.checkSelfPermission(
            this,
            android.Manifest.permission.ACCESS_COARSE_LOCATION,
        ) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted && !coarseGranted) return

        val location = currentLocation() ?: latestKnownLocation() ?: return
        val payload = DeviceLocationUpload(
            latitude = location.latitude,
            longitude = location.longitude,
            accuracy = if (location.hasAccuracy()) location.accuracy else null,
            altitude = if (location.hasAltitude()) location.altitude else null,
            speed = if (location.hasSpeed()) location.speed else null,
            bearing = if (location.hasBearing()) location.bearing else null,
            provider = location.provider,
            recordedAt = Instant.ofEpochMilli(location.time).toString(),
        )

        try {
            apiClient.uploadLocation(deviceToken, payload)
        } catch (error: Exception) {
            telemetryQueue.enqueueLocation(payload)
            Log.w(LOG_TAG, "Location upload queued for retry", error)
        }
        lastLocationUploadAt = now
    }

    private suspend fun flushQueuedLocations(deviceToken: String) {
        var sent = 0
        while (sent < MAX_QUEUE_FLUSH_PER_POLL) {
            val queued = telemetryQueue.peekLocation() ?: return
            try {
                apiClient.uploadLocation(deviceToken, queued)
                telemetryQueue.removeFirstLocation()
                sent += 1
            } catch (error: Exception) {
                Log.d(LOG_TAG, "Queued location still waiting for connectivity")
                return
            }
        }
    }

    private suspend fun currentLocation(): Location? {
        val provider = when {
            locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) ->
                LocationManager.GPS_PROVIDER
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ->
                LocationManager.NETWORK_PROVIDER
            else -> return null
        }

        return try {
            suspendCancellableCoroutine { continuation ->
                val cancellationSignal = CancellationSignal()
                continuation.invokeOnCancellation { cancellationSignal.cancel() }
                locationManager.getCurrentLocation(
                    provider,
                    cancellationSignal,
                    mainExecutor,
                ) { location ->
                    if (continuation.isActive) continuation.resume(location)
                }
            }
        } catch (error: SecurityException) {
            Log.w(LOG_TAG, "Location permission unavailable", error)
            null
        } catch (error: Exception) {
            Log.w(LOG_TAG, "Fresh location unavailable; using last known location", error)
            null
        }
    }

    private fun latestKnownLocation(): Location? {
        return locationManager.getProviders(true)
            .mapNotNull { provider ->
                try {
                    locationManager.getLastKnownLocation(provider)
                } catch (_: SecurityException) {
                    null
                }
            }
            .maxByOrNull { it.time }
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

        private const val LOCATION_UPLOAD_INTERVAL_MS =
            60_000L

        private const val MAX_QUEUE_FLUSH_PER_POLL = 20

        private const val ENABLE_SCAN_OBSERVER_PROBE = false
    }
}
