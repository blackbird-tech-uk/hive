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
