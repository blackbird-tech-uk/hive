package com.blackbird.hiveagent.data.local

import android.content.Context
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.blackbird.hiveagent.BuildConfig
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(
    name = "hive_agent_preferences",
)

class TokenStorage(
    context: Context,
) {
    private val applicationContext =
        context.applicationContext

    private object Keys {
        val DEVICE_TOKEN =
            stringPreferencesKey("device_token")

        val SERVER_URL =
            stringPreferencesKey("server_url")
    }

    val deviceToken: Flow<String?> =
        applicationContext.dataStore.data.map {
            preferences ->
            preferences[Keys.DEVICE_TOKEN]
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
        }

    val serverUrl: Flow<String> =
        applicationContext.dataStore.data.map {
            preferences ->
            normaliseServerUrl(
                preferences[Keys.SERVER_URL]
                    ?: BuildConfig.API_BASE_URL,
            )
        }

    suspend fun getDeviceToken(): String? {
        return deviceToken.first()
    }

    suspend fun getServerUrl(): String {
        return serverUrl.first()
    }

    suspend fun saveEnrollment(
        token: String,
        serverUrl: String,
    ) {
        val cleanToken = token.trim()

        require(cleanToken.isNotEmpty()) {
            "The device token cannot be empty."
        }

        val cleanServerUrl =
            normaliseServerUrl(serverUrl)

        applicationContext.dataStore.edit {
            preferences ->
            preferences[Keys.DEVICE_TOKEN] =
                cleanToken

            preferences[Keys.SERVER_URL] =
                cleanServerUrl
        }

        Log.d(
            LOG_TAG,
            "Enrollment credentials saved.",
        )
    }

    suspend fun saveDeviceToken(
        token: String,
    ) {
        saveEnrollment(
            token = token,
            serverUrl = getServerUrl(),
        )
    }

    suspend fun clearEnrollment() {
        applicationContext.dataStore.edit {
            preferences ->
            preferences.remove(Keys.DEVICE_TOKEN)
            preferences.remove(Keys.SERVER_URL)
        }

        Log.d(
            LOG_TAG,
            "Enrollment credentials cleared.",
        )
    }

    suspend fun clearDeviceToken() {
        clearEnrollment()
    }

    companion object {
        private const val LOG_TAG =
            "HiveHeartbeat"

        fun normaliseServerUrl(
            value: String,
        ): String {
            val cleanValue =
                value.trim().trimEnd('/')

            require(
                cleanValue.startsWith("http://") ||
                    cleanValue.startsWith("https://"),
            ) {
                "The Hive server URL must use HTTP or HTTPS."
            }

            return cleanValue
        }
    }
}