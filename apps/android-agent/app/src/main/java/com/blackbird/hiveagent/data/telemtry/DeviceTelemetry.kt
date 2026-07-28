package com.blackbird.hiveagent.data.telemetry

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.wifi.WifiManager
import android.os.BatteryManager
import java.net.Inet4Address

data class TelemetrySnapshot(
    val batteryLevel: Int?,
    val isCharging: Boolean?,
    val wifiSsid: String?,
    val ipAddress: String?
)

object DeviceTelemetry {

    fun collect(context: Context): TelemetrySnapshot {
        val battery = readBattery(context)

        return TelemetrySnapshot(
            batteryLevel = battery.first,
            isCharging = battery.second,
            wifiSsid = readWifiSsid(context),
            ipAddress = readIpAddress(context)
        )
    }

    private fun readBattery(
        context: Context
    ): Pair<Int?, Boolean?> {
        val batteryIntent =
            context.registerReceiver(
                null,
                IntentFilter(
                    Intent.ACTION_BATTERY_CHANGED
                )
            ) ?: return Pair(null, null)

        val level = batteryIntent.getIntExtra(
            BatteryManager.EXTRA_LEVEL,
            -1
        )

        val scale = batteryIntent.getIntExtra(
            BatteryManager.EXTRA_SCALE,
            -1
        )

        val percentage =
            if (level >= 0 && scale > 0) {
                (level * 100) / scale
            } else {
                null
            }

        val status = batteryIntent.getIntExtra(
            BatteryManager.EXTRA_STATUS,
            -1
        )

        val charging =
            when (status) {
                BatteryManager.BATTERY_STATUS_CHARGING,
                BatteryManager.BATTERY_STATUS_FULL -> true

                BatteryManager.BATTERY_STATUS_DISCHARGING,
                BatteryManager.BATTERY_STATUS_NOT_CHARGING ->
                    false

                else -> null
            }

        return Pair(
            percentage,
            charging
        )
    }

    @Suppress("DEPRECATION")
    private fun readWifiSsid(
        context: Context
    ): String? {
        return try {
            val wifiManager =
                context.applicationContext
                    .getSystemService(
                        Context.WIFI_SERVICE
                    ) as WifiManager

            val ssid =
                wifiManager.connectionInfo?.ssid
                    ?.removeSurrounding("\"")

            when {
                ssid.isNullOrBlank() -> null

                ssid.equals(
                    "<unknown ssid>",
                    ignoreCase = true
                ) -> null

                else -> ssid
            }
        } catch (_: SecurityException) {
            null
        }
    }

    private fun readIpAddress(
        context: Context
    ): String? {
        val connectivityManager =
            context.getSystemService(
                Context.CONNECTIVITY_SERVICE
            ) as ConnectivityManager

        val activeNetwork =
            connectivityManager.activeNetwork
                ?: return null

        val linkProperties =
            connectivityManager.getLinkProperties(
                activeNetwork
            ) ?: return null

        return linkProperties.linkAddresses
            .map { it.address }
            .firstOrNull {
                it is Inet4Address &&
                        !it.isLoopbackAddress
            }
            ?.hostAddress
    }
}