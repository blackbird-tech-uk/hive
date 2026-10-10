package com.blackbird.hiveagent.device

import android.Manifest
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat
import com.blackbird.hiveagent.BuildConfig
import com.blackbird.hiveagent.HiveDeviceAdminReceiver
import com.blackbird.hiveagent.api.DeviceHeartbeatRequest
import com.blackbird.hiveagent.data.telemetry.DeviceTelemetry

class DeviceInfoProvider(
    context: Context,
) {
    private val applicationContext =
        context.applicationContext

    private val devicePolicyManager =
        applicationContext.getSystemService(
            Context.DEVICE_POLICY_SERVICE,
        ) as DevicePolicyManager

    private val adminComponent =
        ComponentName(
            applicationContext,
            HiveDeviceAdminReceiver::class.java,
        )

    fun createHeartbeatRequest():
        DeviceHeartbeatRequest {
        val telemetry =
            DeviceTelemetry.collect(
                applicationContext,
            )
        val isDeviceOwner =
            devicePolicyManager.isDeviceOwnerApp(
                applicationContext.packageName,
            )

        val isDeviceAdmin =
            devicePolicyManager.isAdminActive(
                adminComponent,
            )

        val managementMode =
            when {
                isDeviceOwner -> "device_owner"
                isDeviceAdmin -> "device_admin"
                else -> "standard"
            }

        val supportsLockTask =
            isDeviceOwner

        val supportsDeviceLock =
            isDeviceOwner || isDeviceAdmin

        val supportsCameraPolicy =
            isDeviceOwner

        val supportsLockTimeoutPolicy =
            isDeviceOwner || isDeviceAdmin

        val cameraDisabled =
            if (supportsCameraPolicy) {
                try {
                    devicePolicyManager.getCameraDisabled(
                        adminComponent,
                    )
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }

        val maximumTimeToLockMs =
            if (supportsLockTimeoutPolicy) {
                try {
                    devicePolicyManager.getMaximumTimeToLock(
                        adminComponent,
                    )
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }

        val activityManager =
            applicationContext.getSystemService(
                Context.ACTIVITY_SERVICE,
            ) as ActivityManager

        val isLockTaskActive =
            activityManager.lockTaskModeState !=
                ActivityManager.LOCK_TASK_MODE_NONE

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
            managementMode =
                managementMode,
            isDeviceAdmin =
                isDeviceAdmin,
            isDeviceOwner =
                isDeviceOwner,
            supportsLockTask =
                supportsLockTask,
            supportsDeviceLock =
                supportsDeviceLock,
            isLockTaskActive =
                isLockTaskActive,
            supportsCameraPolicy =
                supportsCameraPolicy,
            supportsLockTimeoutPolicy =
                supportsLockTimeoutPolicy,
            cameraDisabled =
                cameraDisabled,
            maximumTimeToLockMs =
                maximumTimeToLockMs,
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










