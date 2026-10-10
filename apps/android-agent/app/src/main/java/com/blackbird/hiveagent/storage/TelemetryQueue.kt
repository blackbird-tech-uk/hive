package com.blackbird.hiveagent.storage

import android.content.Context
import com.blackbird.hiveagent.api.DeviceLocationUpload
import org.json.JSONArray
import org.json.JSONObject

class TelemetryQueue(context: Context) {
    private val preferences = context.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    @Synchronized
    fun enqueueLocation(location: DeviceLocationUpload) {
        val queue = readQueue()
        queue.put(location.toJson())
        while (queue.length() > MAX_LOCATION_ITEMS) {
            queue.remove(0)
        }
        writeQueue(queue)
    }

    @Synchronized
    fun peekLocation(): DeviceLocationUpload? {
        val queue = readQueue()
        if (queue.length() == 0) return null
        return queue.getJSONObject(0).toLocationUpload()
    }

    @Synchronized
    fun removeFirstLocation() {
        val queue = readQueue()
        if (queue.length() == 0) return
        queue.remove(0)
        writeQueue(queue)
    }

    private fun readQueue(): JSONArray {
        val raw = preferences.getString(KEY_LOCATION_QUEUE, null)
        return if (raw.isNullOrBlank()) JSONArray() else runCatching {
            JSONArray(raw)
        }.getOrDefault(JSONArray())
    }

    private fun writeQueue(queue: JSONArray) {
        preferences.edit()
            .putString(KEY_LOCATION_QUEUE, queue.toString())
            .apply()
    }

    private fun DeviceLocationUpload.toJson() = JSONObject().apply {
        put("latitude", latitude)
        put("longitude", longitude)
        putNullable("accuracy", accuracy)
        putNullable("altitude", altitude)
        putNullable("speed", speed)
        putNullable("bearing", bearing)
        putNullable("provider", provider)
        put("recorded_at", recordedAt)
    }

    private fun JSONObject.toLocationUpload() = DeviceLocationUpload(
        latitude = getDouble("latitude"),
        longitude = getDouble("longitude"),
        accuracy = nullableDouble("accuracy")?.toFloat(),
        altitude = nullableDouble("altitude"),
        speed = nullableDouble("speed")?.toFloat(),
        bearing = nullableDouble("bearing")?.toFloat(),
        provider = if (isNull("provider")) null else optString("provider"),
        recordedAt = getString("recorded_at"),
    )

    private fun JSONObject.nullableDouble(key: String): Double? =
        if (!has(key) || isNull(key)) null else getDouble(key)

    private fun JSONObject.putNullable(key: String, value: Any?) {
        put(key, value ?: JSONObject.NULL)
    }

    companion object {
        private const val PREFERENCES_NAME = "hive_telemetry_queue"
        private const val KEY_LOCATION_QUEUE = "location_queue"
        private const val MAX_LOCATION_ITEMS = 720
    }
}
