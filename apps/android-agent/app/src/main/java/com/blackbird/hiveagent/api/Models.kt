package com.blackbird.hiveagent.api

data class DeviceHeartbeatRequest(
    val batteryLevel: Int?,
    val isCharging: Boolean?,
    val wifiSsid: String?,
    val ipAddress: String?,
    val agentVersion: String?,
    val androidVersion: String?,
    val buildVersion: String?,
    val imei: String?,
    val managementMode: String?,
    val isDeviceAdmin: Boolean?,
    val isDeviceOwner: Boolean?,
    val supportsLockTask: Boolean?,
)

data class DeviceCommand(
    val id: String,
    val command: String,
    val payload: Map<String, Any?>,
    val createdAt: String,
)

data class DeviceHeartbeatResponse(
    val deviceId: String,
    val hiveId: String,
    val accepted: Boolean,
    val heartbeatIntervalSeconds: Int,
    val commands: List<DeviceCommand>,
)

data class DeviceLocationUpload(
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float?,
    val altitude: Double?,
    val speed: Float?,
    val bearing: Float?,
    val provider: String?,
    val recordedAt: String,
)

data class DeviceLocationResponse(
    val id: String,
    val organizationId: String,
    val deviceId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy: Float?,
    val altitude: Double?,
    val speed: Float?,
    val bearing: Float?,
    val provider: String?,
    val recordedAt: String,
    val createdAt: String,
)

data class CommandExecutionResult(
    val successful: Boolean,
    val message: String,
)
data class InstalledApplicationUpload(
    val packageName: String,
    val appName: String?,
    val versionName: String?,
    val versionCode: Long?,
    val isSystemApp: Boolean,
    val isEnabled: Boolean,
    val firstInstalledAt: String?,
    val lastUpdatedAt: String?,
)

data class InstalledApplicationInventoryResponse(
    val deviceId: String,
    val applicationCount: Int,
    val reportedAt: String,
)





