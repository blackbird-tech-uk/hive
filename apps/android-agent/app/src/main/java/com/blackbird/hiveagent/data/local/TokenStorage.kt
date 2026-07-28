package com.blackbird.hiveagent.data.local

import android.content.Context
import android.util.Log
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
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
            stringPreferencesKey(
                "device_token",
            )
    }

    val deviceToken: Flow<String?> =
        applicationContext.dataStore.data.map { preferences ->
            preferences[Keys.DEVICE_TOKEN]
                ?.trim()
                ?.takeIf { token ->
                    token.isNotEmpty()
                }
        }

    suspend fun getDeviceToken(): String? {
        val token =
            deviceToken.first()

        Log.d(
            LOG_TAG,
            if (token.isNullOrBlank()) {
                "TokenStorage read: no device token"
            } else {
                "TokenStorage read: device token exists"
            },
        )

        return token
    }

    suspend fun saveDeviceToken(
        token: String,
    ) {
        val cleanToken =
            token.trim()

        require(cleanToken.isNotEmpty()) {
            "The device token cannot be empty."
        }

        applicationContext.dataStore.edit { preferences ->
            preferences[Keys.DEVICE_TOKEN] =
                cleanToken
        }

        Log.d(
            LOG_TAG,
            "TokenStorage save completed",
        )
    }

    suspend fun clearDeviceToken() {
        applicationContext.dataStore.edit { preferences ->
            preferences.remove(
                Keys.DEVICE_TOKEN,
            )
        }

        Log.d(
            LOG_TAG,
            "TokenStorage clear completed",
        )
    }

    companion object {
        private const val LOG_TAG =
            "HiveHeartbeat"
    }
}