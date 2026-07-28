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
