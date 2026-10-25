package com.blackbird.hiveagent

import android.app.Application
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.blackbird.hiveagent.data.local.TokenStorage
import com.blackbird.hiveagent.data.network.ApiClient
import com.blackbird.hiveagent.data.network.DeviceAgentResponse
import com.blackbird.hiveagent.data.network.EnrollmentRequest
import com.blackbird.hiveagent.worker.HeartbeatScheduler
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import retrofit2.HttpException
import com.blackbird.hiveagent.BuildConfig

data class HiveUiState(
    val isLoading: Boolean = true,
    val isEnrolling: Boolean = false,
    val isEnrolled: Boolean = false,
    val device: DeviceAgentResponse? = null,
    val hasStoredEnrolment: Boolean = false,
    val error: String? = null,
)

class HiveViewModel(
    application: Application,
) : AndroidViewModel(application) {

    private val applicationContext =
        application.applicationContext

    private val tokenStorage =
        TokenStorage(applicationContext)

    private val _uiState =
        MutableStateFlow(
            HiveUiState(),
        )

    val uiState: StateFlow<HiveUiState> =
        _uiState.asStateFlow()

    fun loadDevice() {
    viewModelScope.launch {
        Log.d(
            LOG_TAG,
            "Loading local enrolment",
        )

        // A refresh is not an unenrolment. Keep the running command
        // service active until credentials are explicitly removed.
        _uiState.value =
            _uiState.value.copy(
                isLoading = true,
                error = null,
            )

        try {
            val storedToken =
                tokenStorage.getDeviceToken()

            val storedServerUrl =
                tokenStorage.getServerUrl()

            if (storedToken.isNullOrBlank()) {
                Log.d(
                    LOG_TAG,
                    "No stored device token was found",
                )

                HeartbeatScheduler.cancel(
                    applicationContext,
                )

                _uiState.value =
                    HiveUiState(
                        isLoading = false,
                        isEnrolled = false,
                    )

                return@launch
            }

            Log.d(
                LOG_TAG,
                "Stored device token found",
            )

            loadDeviceWithToken(
                deviceToken = storedToken,
                serverUrl = storedServerUrl,
            )
        } catch (error: Exception) {
            Log.e(
                LOG_TAG,
                "Failed to load local enrolment",
                error,
            )

            // Preserve the current enrolment state on a local read error.
            // A failed DataStore read is not permission to forget a scanner.
            _uiState.value =
                _uiState.value.copy(
                    isLoading = false,
                    error = readableError(error),
                )
        }
    }
}

 fun enrolDevice(
    enrollmentToken: String,
    assetId: String,
    serverUrl: String?,
)
    {
        val cleanEnrollmentToken =
            enrollmentToken
                .trim()
                .uppercase()

        val cleanAssetId =
            assetId
                .trim()
                .uppercase()
                val cleanServerUrl =
    try {
        TokenStorage.normaliseServerUrl(
            serverUrl
                ?.takeIf { it.isNotBlank() }
                ?: BuildConfig.API_BASE_URL,
        )
    } catch (error: IllegalArgumentException) {
        _uiState.value =
            _uiState.value.copy(
                error = error.message,
            )

        return
    }

        if (cleanEnrollmentToken.isBlank()) {
            _uiState.value =
                _uiState.value.copy(
                    error = "Enter an enrolment token.",
                )

            return
        }

        if (cleanAssetId.isBlank()) {
            _uiState.value =
                _uiState.value.copy(
                    error = "Enter an asset ID.",
                )

            return
        }

        viewModelScope.launch {
            Log.d(
                LOG_TAG,
                "Starting enrolment for asset $cleanAssetId",
            )

            _uiState.value =
                _uiState.value.copy(
                    isLoading = false,
                    isEnrolling = true,
                    error = null,
                )

            try {
                val request =
                    EnrollmentRequest(
                        token = cleanEnrollmentToken,
                        asset_id = cleanAssetId,
                        serial_number =
                            getDeviceIdentifier(),
                        imei = null,
                        manufacturer =
                            Build.MANUFACTURER,
                        model =
                            Build.MODEL,
                        android_version =
                            Build.VERSION.RELEASE
                                ?: "Unknown",
                        build_version =
                            Build.DISPLAY
                                ?: "Unknown",
                    )

                Log.d(
                    LOG_TAG,
                    "Sending enrolment request",
                )

               val response =
    ApiClient
        .create(cleanServerUrl)
        .redeemEnrollment(
            request = request,
        )

                val deviceToken =
                    response.device_token.trim()

                if (deviceToken.isBlank()) {
                    throw IllegalStateException(
                        "Hive returned an empty device token.",
                    )
                }

                Log.d(
                    LOG_TAG,
                    "Enrolment accepted. Saving device token.",
                )

              tokenStorage.saveEnrollment(
    token = deviceToken,
    serverUrl = cleanServerUrl,
)

/*
 * Read the credentials back before making any
 * other request or scheduling WorkManager.
 */
val storedToken =
    tokenStorage.getDeviceToken()

val storedServerUrl =
    tokenStorage.getServerUrl()

if (storedToken.isNullOrBlank()) {
    throw IllegalStateException(
        "The device token could not be read after saving.",
    )
}

if (storedToken != deviceToken) {
    throw IllegalStateException(
        "The stored device token does not match " +
            "the enrolment response.",
    )
}

Log.d(
    LOG_TAG,
    "Device token saved and verified",
)

loadDeviceWithToken(
    deviceToken = storedToken,
    serverUrl = storedServerUrl,
)

            } catch (error: Exception) {
                Log.e(
                    LOG_TAG,
                    "Device enrolment failed",
                    error,
                )

                _uiState.value =
                    HiveUiState(
                        isLoading = false,
                        isEnrolling = false,
                        isEnrolled = false,
                        error = readableError(error),
                    )
            }
        }
    }

    fun clearEnrolment() {
        viewModelScope.launch {
            Log.d(
                LOG_TAG,
                "Removing local enrolment",
            )

            HeartbeatScheduler.cancel(
                applicationContext,
            )

            tokenStorage.clearDeviceToken()

            _uiState.value =
                HiveUiState(
                    isLoading = false,
                    isEnrolled = false,
                )
        }
    }

    private suspend fun loadDeviceWithToken(
    deviceToken: String,
    serverUrl: String,
)
{
        try {
            Log.d(
                LOG_TAG,
                "Loading device from Hive",
            )

            val device =
    ApiClient
        .create(serverUrl)
        .getDevice(
            authorization =
                "Bearer $deviceToken",
        )

            Log.d(
                LOG_TAG,
                "Device loaded successfully",
            )

            _uiState.value =
                HiveUiState(
                    isLoading = false,
                    isEnrolled = true,
                    device = device,
                    hasStoredEnrolment = true,
                )

            /*
             * Schedule heartbeat only after the backend has
             * accepted the device token.
             */
            HeartbeatScheduler.schedule(
                applicationContext,
            )

            Log.d(
                LOG_TAG,
                "Heartbeat scheduled after device authentication",
            )
        } catch (error: Exception) {
            // An authentication or connectivity failure is not an unenrolment.
            // Keep the saved credentials until the user explicitly removes them.
            Log.e(
                LOG_TAG,
                "Device validation failed; retaining local enrolment",
                error,
            )
            _uiState.value =
                HiveUiState(
                    isLoading = false,
                    isEnrolled = false,
                    hasStoredEnrolment = true,
                    error = readableError(error),
                )
        }
    }

    private fun getDeviceIdentifier(): String {
        return Settings.Secure.getString(
            applicationContext.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: "unknown-device"
    }

    private fun readableError(
        error: Exception,
    ): String {
        if (error is HttpException) {
            val serverMessage =
                extractServerMessage(error)

            if (!serverMessage.isNullOrBlank()) {
                return serverMessage
            }

            return when (error.code()) {
                400 ->
                    "The enrolment request was rejected."

                401 ->
                    "Hive rejected the device token."

                404 ->
                    "The enrolment token or device was not found."

                409 ->
                    "This device is already enrolled or its identifiers are already in use."

                410 ->
                    "The enrolment token has expired, has been revoked, or has no uses remaining."

                422 ->
                    "Hive could not validate the device information."

                else ->
                    "Hive returned HTTP ${error.code()}."
            }
        }

        return error.message
            ?: "Unable to connect to Hive. Check the network and try again."
    }

    private fun extractServerMessage(
        error: HttpException,
    ): String? {
        return try {
            val body =
                error.response()
                    ?.errorBody()
                    ?.string()
                    ?.trim()
                    .orEmpty()

            if (body.isBlank()) {
                return null
            }

            val json =
                org.json.JSONObject(body)

            when (val detail = json.opt("detail")) {
                is String ->
                    detail.takeIf { it.isNotBlank() }

                is org.json.JSONArray -> {
                    val messages =
                        buildList {
                            for (index in 0 until detail.length()) {
                                val item =
                                    detail.optJSONObject(index)

                                val message =
                                    item?.optString("msg")
                                        ?.trim()

                                if (!message.isNullOrBlank()) {
                                    add(message)
                                }
                            }
                        }

                    messages
                        .distinct()
                        .joinToString("\n")
                        .takeIf { it.isNotBlank() }
                }

                else -> null
            }
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        private const val LOG_TAG =
            "HiveHeartbeat"
    }
}