package com.blackbird.hiveagent.api

import com.blackbird.hiveagent.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class HiveApiException(
    message: String,
    val statusCode: Int? = null,
) : Exception(message)

class HiveApiClient(
    private val baseUrl: String = BuildConfig.API_BASE_URL.trimEnd('/'),
) {
    suspend fun sendHeartbeat(
        deviceToken: String,
        payload: DeviceHeartbeatRequest,
    ): DeviceHeartbeatResponse {
        val body = JSONObject().apply {
            putNullable("battery_level", payload.batteryLevel)
            putNullable("is_charging", payload.isCharging)
            putNullable("wifi_ssid", payload.wifiSsid)
            putNullable("ip_address", payload.ipAddress)
            putNullable("agent_version", payload.agentVersion)
            putNullable("android_version", payload.androidVersion)
            putNullable("build_version", payload.buildVersion)
        }

        return parseHeartbeatResponse(
            post(
                path = "/device-agent/heartbeat",
                token = deviceToken,
                body = body,
            ),
        )
    }

    suspend fun acknowledgeCommand(
        deviceToken: String,
        commandId: String,
    ) {
        post(
            path = "/device-commands/$commandId/acknowledge",
            token = deviceToken,
            body = null,
        )
    }

    suspend fun completeCommand(
        deviceToken: String,
        commandId: String,
        resultMessage: String,
    ) {
        post(
            path = "/device-commands/$commandId/complete",
            token = deviceToken,
            body = JSONObject().put(
                "result_message",
                resultMessage,
            ),
        )
    }

    suspend fun failCommand(
        deviceToken: String,
        commandId: String,
        resultMessage: String,
    ) {
        post(
            path = "/device-commands/$commandId/fail",
            token = deviceToken,
            body = JSONObject().put(
                "result_message",
                resultMessage,
            ),
        )
    }

    private suspend fun post(
        path: String,
        token: String,
        body: JSONObject?,
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL("$baseUrl$path")
            .openConnection() as HttpURLConnection

        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty(
                "Authorization",
                "Bearer $token",
            )
            connection.setRequestProperty(
                "Accept",
                "application/json",
            )

            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty(
                    "Content-Type",
                    "application/json",
                )

                connection.outputStream.bufferedWriter().use {
                    it.write(body.toString())
                }
            }

            val statusCode = connection.responseCode
            val stream = if (statusCode in 200..299) {
                connection.inputStream
            } else {
                connection.errorStream
            }

            val responseText = stream
                ?.bufferedReader()
                ?.use { it.readText() }
                .orEmpty()

            if (statusCode !in 200..299) {
                throw HiveApiException(
                    message = "Hive API returned HTTP $statusCode: $responseText",
                    statusCode = statusCode,
                )
            }

            if (responseText.isBlank()) {
                JSONObject()
            } else {
                JSONObject(responseText)
            }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseHeartbeatResponse(
        json: JSONObject,
    ): DeviceHeartbeatResponse {
        val commandsJson = json.optJSONArray("commands") ?: JSONArray()

        val commands = buildList {
            for (index in 0 until commandsJson.length()) {
                val commandJson = commandsJson.getJSONObject(index)

                add(
                    DeviceCommand(
                        id = commandJson.getString("id"),
                        command = commandJson.getString("command"),
                        payload = parsePayload(
                            commandJson.optJSONObject("payload"),
                        ),
                        createdAt = commandJson.getString("created_at"),
                    ),
                )
            }
        }

        return DeviceHeartbeatResponse(
            deviceId = json.getString("device_id"),
            hiveId = json.getString("hive_id"),
            accepted = json.optBoolean("accepted", true),
            heartbeatIntervalSeconds = json.optInt(
                "heartbeat_interval_seconds",
                300,
            ),
            commands = commands,
        )
    }

    private fun parsePayload(
        json: JSONObject?,
    ): Map<String, Any?> {
        if (json == null) {
            return emptyMap()
        }

        return buildMap {
            val keys = json.keys()

            while (keys.hasNext()) {
                val key = keys.next()
                val value = json.opt(key)
                put(key, if (value == JSONObject.NULL) null else value)
            }
        }
    }

    private fun JSONObject.putNullable(
        key: String,
        value: Any?,
    ) {
        put(key, value ?: JSONObject.NULL)
    }
}
