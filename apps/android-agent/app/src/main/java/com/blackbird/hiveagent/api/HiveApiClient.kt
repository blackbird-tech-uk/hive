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
            putNullable("management_mode", payload.managementMode)
            putNullable("is_device_admin", payload.isDeviceAdmin)
            putNullable("is_device_owner", payload.isDeviceOwner)
            putNullable("supports_lock_task", payload.supportsLockTask)
        }

        return parseHeartbeatResponse(
            post(
                path = "/device-agent/heartbeat",
                token = deviceToken,
                body = body,
            ),
        )
    }

    suspend fun uploadLocation(
        deviceToken: String,
        payload: DeviceLocationUpload,
    ): DeviceLocationResponse {
        val body = JSONObject().apply {
            put("latitude", payload.latitude)
            put("longitude", payload.longitude)
            putNullable("accuracy", payload.accuracy)
            putNullable("altitude", payload.altitude)
            putNullable("speed", payload.speed)
            putNullable("bearing", payload.bearing)
            putNullable("provider", payload.provider)
            put("recorded_at", payload.recordedAt)
        }

        return parseLocationResponse(
            post(
                path = "/device-agent/location",
                token = deviceToken,
                body = body,
            ),
        )
    }

    suspend fun uploadInstalledApplications(
        deviceToken: String,
        applications: List<InstalledApplicationUpload>,
    ): InstalledApplicationInventoryResponse {
        val applicationsJson = JSONArray()

        applications.forEach { application ->
            applicationsJson.put(
                JSONObject().apply {
                    put("package_name", application.packageName)
                    putNullable("app_name", application.appName)
                    putNullable("version_name", application.versionName)
                    putNullable("version_code", application.versionCode)
                    put("is_system_app", application.isSystemApp)
                    put("is_enabled", application.isEnabled)
                    putNullable(
                        "first_installed_at",
                        application.firstInstalledAt,
                    )
                    putNullable(
                        "last_updated_at",
                        application.lastUpdatedAt,
                    )
                },
            )
        }

        val response = post(
            path = "/device-agent/apps",
            token = deviceToken,
            body = JSONObject().put(
                "applications",
                applicationsJson,
            ),
        )

        return InstalledApplicationInventoryResponse(
            deviceId = response.getString("device_id"),
            applicationCount =
                response.getInt("application_count"),
            reportedAt =
                response.getString("reported_at"),
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

                connection.outputStream
                    .bufferedWriter()
                    .use { writer ->
                        writer.write(body.toString())
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
                ?.use { reader ->
                    reader.readText()
                }
                .orEmpty()

            if (statusCode !in 200..299) {
                throw HiveApiException(
                    message = buildString {
                        append("Hive API returned HTTP ")
                        append(statusCode)
                        append(": ")
                        append(responseText)
                    },
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
        val commandsJson =
            json.optJSONArray("commands") ?: JSONArray()

        val commands = buildList {
            for (index in 0 until commandsJson.length()) {
                val commandJson =
                    commandsJson.getJSONObject(index)

                add(
                    DeviceCommand(
                        id = commandJson.getString("id"),
                        command = commandJson.getString(
                            "command",
                        ),
                        payload = parsePayload(
                            commandJson.optJSONObject(
                                "payload",
                            ),
                        ),
                        createdAt = commandJson.getString(
                            "created_at",
                        ),
                    ),
                )
            }
        }

        return DeviceHeartbeatResponse(
            deviceId = json.getString("device_id"),
            hiveId = json.getString("hive_id"),
            accepted = json.optBoolean(
                "accepted",
                true,
            ),
            heartbeatIntervalSeconds = json.optInt(
                "heartbeat_interval_seconds",
                300,
            ),
            commands = commands,
        )
    }

    private fun parseLocationResponse(
        json: JSONObject,
    ): DeviceLocationResponse {
        return DeviceLocationResponse(
            id = json.getString("id"),
            organizationId = json.getString(
                "organization_id",
            ),
            deviceId = json.getString("device_id"),
            latitude = json.getDouble("latitude"),
            longitude = json.getDouble("longitude"),
            accuracy = json.optNullableFloat(
                "accuracy",
            ),
            altitude = json.optNullableDouble(
                "altitude",
            ),
            speed = json.optNullableFloat(
                "speed",
            ),
            bearing = json.optNullableFloat(
                "bearing",
            ),
            provider = json.optNullableString(
                "provider",
            ),
            recordedAt = json.getString(
                "recorded_at",
            ),
            createdAt = json.getString(
                "created_at",
            ),
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

                put(
                    key,
                    if (value == JSONObject.NULL) {
                        null
                    } else {
                        value
                    },
                )
            }
        }
    }

    private fun JSONObject.putNullable(
        key: String,
        value: Any?,
    ) {
        put(
            key,
            value ?: JSONObject.NULL,
        )
    }

    private fun JSONObject.optNullableString(
        key: String,
    ): String? {
        if (!has(key) || isNull(key)) {
            return null
        }

        return optString(key)
            .trim()
            .takeIf { value ->
                value.isNotEmpty()
            }
    }

    private fun JSONObject.optNullableDouble(
        key: String,
    ): Double? {
        if (!has(key) || isNull(key)) {
            return null
        }

        return optDouble(key)
    }

    private fun JSONObject.optNullableFloat(
        key: String,
    ): Float? {
        return optNullableDouble(key)?.toFloat()
    }
}

