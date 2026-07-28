package com.blackbird.hiveagent.data.network

import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

data class DeviceAgentResponse(
    val id: String,
    val organization_id: String,
    val hive_id: String,
    val asset_id: String,
    val serial_number: String,
    val imei: String?,
    val manufacturer: String?,
    val model: String,
    val android_version: String?,
    val build_version: String?,
    val agent_version: String?,
    val battery_level: Int?,
    val is_charging: Boolean?,
    val wifi_ssid: String?,
    val ip_address: String?,
    val enrolled_at: String?,
    val last_seen_at: String?
)

data class HeartbeatRequest(
    val battery_level: Int?,
    val is_charging: Boolean?,
    val wifi_ssid: String?,
    val ip_address: String?,
    val agent_version: String?,
    val android_version: String?,
    val build_version: String?
)

data class HeartbeatResponse(
    val device_id: String,
    val hive_id: String,
    val accepted: Boolean,
    val server_time: String,
    val heartbeat_interval_seconds: Int,
    val last_seen_at: String
)

interface HiveApi {

    @POST("enrollment/redeem")
    suspend fun redeemEnrollment(
        @Body request: EnrollmentRequest
    ): EnrollmentResponse

    @GET("device-agent/me")
    suspend fun getDevice(
        @Header("Authorization") authorization: String
    ): DeviceAgentResponse

    @POST("device-agent/heartbeat")
    suspend fun sendHeartbeat(
        @Header("Authorization") authorization: String,
        @Body request: HeartbeatRequest
    ): HeartbeatResponse
}
