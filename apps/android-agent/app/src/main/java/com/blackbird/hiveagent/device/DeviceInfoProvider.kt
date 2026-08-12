package com.blackbird.hiveagent.device

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.blackbird.hiveagent.BuildConfig
import com.blackbird.hiveagent.api.DeviceHeartbeatRequest
import com.blackbird.hiveagent.data.telemetry.DeviceTelemetry

class DeviceInfoProvider(
    context: Context,
) {
    private val applicationContext =
        context.applicationContext

    fun createHeartbeatRequest():
        DeviceHeartbeatRequest {
        val telemetry =
            DeviceTelemetry.collect(
                applicationContext,
            )

        return DeviceHeartbeatRequest(
            batteryLevel =
                telemetry.batteryLevel,
            isCharging =
                telemetry.isCharging,
            wifiSsid =
                telemetry.wifiSsid,
            ipAddress =
                telemetry.ipAddress,
            imei =
                readImei(),
            agentVersion =
                BuildConfig.VERSION_NAME,
            androidVersion =
                Build.VERSION.RELEASE,
            buildVersion =
                Build.DISPLAY,
        )
    }

    @Suppress("DEPRECATION")
    private fun readImei(): String? {
        if (
            ContextCompat.checkSelfPermission(
                applicationContext,
                Manifest.permission.READ_PHONE_STATE,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return null
        }

        return try {
            val telephonyManager =
                applicationContext.getSystemService(
                    Context.TELEPHONY_SERVICE,
                ) as TelephonyManager

            val imei =
                if (
                    Build.VERSION.SDK_INT >=
                    Build.VERSION_CODES.O
                ) {
                    telephonyManager.imei
                } else {
                    telephonyManager.deviceId
                }

            imei
                ?.trim()
                ?.takeIf {
                    it.matches(
                        Regex("^\\d{15}$"),
                    )
                }
        } catch (_: SecurityException) {
            null
        } catch (_: Exception) {
            null
        }
    }
}