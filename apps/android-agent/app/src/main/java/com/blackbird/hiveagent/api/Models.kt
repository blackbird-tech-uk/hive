package com.blackbird.hiveagent.api

data class DeviceHeartbeatRequest(
    val batteryLevel: Int?,
    val isCharging: Boolean?,
    val wifiSsid: String?,
    val ipAddress: String?,
    val agentVersion: String?,
    val androidVersion: String?,
    val buildVersion: String?,
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

data class CommandExecutionResult(
    val successful: Boolean,
    val message: String,
)
