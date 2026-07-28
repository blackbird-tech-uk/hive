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
