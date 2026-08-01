package com.blackbird.hiveagent.device

import android.content.Context
import android.os.Build
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
            agentVersion =
                BuildConfig.VERSION_NAME,
            androidVersion =
                Build.VERSION.RELEASE,
            buildVersion =
                Build.DISPLAY,
        )
    }
}