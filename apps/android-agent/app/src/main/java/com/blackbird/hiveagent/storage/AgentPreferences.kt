package com.blackbird.hiveagent.storage

import android.content.Context

class AgentPreferences(context: Context) {
    private val preferences = context.getSharedPreferences(
        PREFERENCES_NAME,
        Context.MODE_PRIVATE,
    )

    fun getDeviceToken(): String? =
        preferences
            .getString(KEY_DEVICE_TOKEN, null)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    fun saveDeviceToken(token: String) {
        preferences.edit()
            .putString(KEY_DEVICE_TOKEN, token.trim())
            .apply()
    }

    fun saveHeartbeatInterval(seconds: Int) {
        preferences.edit()
            .putInt(KEY_HEARTBEAT_INTERVAL, seconds)
            .apply()
    }

    companion object {
        private const val PREFERENCES_NAME = "hive_agent_preferences"
        private const val KEY_DEVICE_TOKEN = "device_token"
        private const val KEY_HEARTBEAT_INTERVAL = "heartbeat_interval"
    }
}
