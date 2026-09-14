package com.blackbird.hiveagent.device

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import com.blackbird.hiveagent.HiveDeviceAdminReceiver

/**
 * Single source of truth for Android enterprise capability detection.
 *
 * Device Admin and Device Owner are deliberately kept separate: Android does
 * not grant Device Owner-only APIs simply because the admin receiver is active.
 */
data class EnterpriseCapabilities(
    val isDeviceAdmin: Boolean,
    val isDeviceOwner: Boolean,
    val supportsDeviceLock: Boolean,
    val supportsLockTask: Boolean,
    val supportsCameraPolicy: Boolean,
    val supportsLockTimeoutPolicy: Boolean,
) {
    val managementMode: String
        get() = when {
            isDeviceOwner -> "device_owner"
            isDeviceAdmin -> "device_admin"
            else -> "standard"
        }
}

object EnterpriseCapabilityDetector {
    fun detect(context: Context): EnterpriseCapabilities {
        val applicationContext = context.applicationContext
        val devicePolicyManager = applicationContext.getSystemService(
            Context.DEVICE_POLICY_SERVICE,
        ) as DevicePolicyManager
        val adminComponent = ComponentName(
            applicationContext,
            HiveDeviceAdminReceiver::class.java,
        )

        val isDeviceOwner = devicePolicyManager.isDeviceOwnerApp(
            applicationContext.packageName,
        )
        val isDeviceAdmin = devicePolicyManager.isAdminActive(
            adminComponent,
        )

        return EnterpriseCapabilities(
            isDeviceAdmin = isDeviceAdmin,
            isDeviceOwner = isDeviceOwner,
            supportsDeviceLock = isDeviceOwner || isDeviceAdmin,
            supportsLockTask = isDeviceOwner,
            supportsCameraPolicy = isDeviceOwner,
            supportsLockTimeoutPolicy = isDeviceOwner || isDeviceAdmin,
        )
    }
}
