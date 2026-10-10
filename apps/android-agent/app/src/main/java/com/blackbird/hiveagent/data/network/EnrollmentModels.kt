package com.blackbird.hiveagent.data.network

data class EnrollmentRequest(
    val token: String,
    val asset_id: String,
    val serial_number: String,
    val imei: String?,
    val manufacturer: String,
    val model: String,
    val android_version: String,
    val build_version: String,
)

data class EnrollmentResponse(
    val device_id: String,
    val organization_id: String,
    val hive_id: String,
    val device_token: String,
    val token_type: String,
    val heartbeat_interval_seconds: Int,
    val enrolled_at: String,
)