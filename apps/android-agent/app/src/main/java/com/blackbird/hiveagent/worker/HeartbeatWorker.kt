package com.blackbird.hiveagent.worker

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.WorkerParameters
import com.blackbird.hiveagent.api.HiveApiClient
import com.blackbird.hiveagent.commands.CommandProcessor
import com.blackbird.hiveagent.data.local.TokenStorage
import com.blackbird.hiveagent.device.DeviceInfoProvider
import com.blackbird.hiveagent.storage.AgentPreferences
import kotlinx.coroutines.flow.first

class HeartbeatWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : CoroutineWorker(appContext, workerParams) {

    private val tokenStorage = TokenStorage(appContext)
    private val preferences = AgentPreferences(appContext)
    private val deviceInfoProvider = DeviceInfoProvider(appContext)
    private val apiClient = HiveApiClient()
    private val commandProcessor = CommandProcessor(appContext)

    override suspend fun doWork(): Result {
        Log.d(
            LOG_TAG,
            "HeartbeatWorker started",
        )

        val deviceToken = tokenStorage.deviceToken
            .first()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

        if (deviceToken == null) {
            Log.e(
                LOG_TAG,
                "Heartbeat stopped: device token is missing",
            )

            return Result.failure(
                outputData(
                    "The device has not been enrolled.",
                ),
            )
        }

        Log.d(
            LOG_TAG,
            "Device token found",
        )

        return try {
            Log.d(
                LOG_TAG,
                "Creating heartbeat payload",
            )

            val heartbeatPayload =
                deviceInfoProvider.createHeartbeatRequest()

            Log.d(
                LOG_TAG,
                "Sending heartbeat request",
            )

            val heartbeat = apiClient.sendHeartbeat(
                deviceToken = deviceToken,
                payload = heartbeatPayload,
            )

            Log.d(
                LOG_TAG,
                "Heartbeat accepted by Hive",
            )

            preferences.saveHeartbeatInterval(
                heartbeat.heartbeatIntervalSeconds,
            )

            Log.d(
                LOG_TAG,
                "Saved heartbeat interval: " +
                    "${heartbeat.heartbeatIntervalSeconds} seconds",
            )

            var completedCommands = 0
            var failedCommands = 0

            Log.d(
                LOG_TAG,
                "Heartbeat returned ${heartbeat.commands.size} command(s)",
            )

            for (command in heartbeat.commands) {
                Log.d(
                    LOG_TAG,
                    "Processing command ${command.id}",
                )

                try {
                    apiClient.acknowledgeCommand(
                        deviceToken = deviceToken,
                        commandId = command.id,
                    )

                    Log.d(
                        LOG_TAG,
                        "Command ${command.id} acknowledged",
                    )

                    val commandResult =
                        commandProcessor.execute(command)

                    if (commandResult.successful) {
                        apiClient.completeCommand(
                            deviceToken = deviceToken,
                            commandId = command.id,
                            resultMessage = commandResult.message,
                        )

                        completedCommands += 1

                        Log.d(
                            LOG_TAG,
                            "Command ${command.id} completed",
                        )
                    } else {
                        apiClient.failCommand(
                            deviceToken = deviceToken,
                            commandId = command.id,
                            resultMessage = commandResult.message,
                        )

                        failedCommands += 1

                        Log.e(
                            LOG_TAG,
                            "Command ${command.id} failed: " +
                                commandResult.message,
                        )
                    }
                } catch (error: Exception) {
                    failedCommands += 1

                    Log.e(
                        LOG_TAG,
                        "Command ${command.id} threw an exception",
                        error,
                    )

                    runCatching {
                        apiClient.failCommand(
                            deviceToken = deviceToken,
                            commandId = command.id,
                            resultMessage = error.message
                                ?: "Command execution failed.",
                        )
                    }.onFailure { reportingError ->
                        Log.e(
                            LOG_TAG,
                            "Could not report command failure " +
                                "for ${command.id}",
                            reportingError,
                        )
                    }
                }
            }

            val successMessage =
                "Heartbeat accepted. " +
                    "$completedCommands command(s) completed and " +
                    "$failedCommands command(s) failed."

            Log.d(
                LOG_TAG,
                successMessage,
            )

            Result.success(
                outputData(successMessage),
            )
        } catch (error: Exception) {
            Log.e(
                LOG_TAG,
                "Heartbeat request failed. WorkManager will retry.",
                error,
            )

            Result.retry()
        }
    }

    private fun outputData(message: String): Data =
        Data.Builder()
            .putString(
                OUTPUT_MESSAGE,
                message,
            )
            .build()

    companion object {
        private const val LOG_TAG = "HiveHeartbeat"

        const val OUTPUT_MESSAGE =
            "heartbeat_result"
    }
}