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

data class HiveUiState(
    val isLoading: Boolean = true,
    val isEnrolled: Boolean = false,
    val device: DeviceAgentResponse? = null,
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

            _uiState.value =
                HiveUiState(
                    isLoading = true,
                )

            try {
                val storedToken =
                    tokenStorage.getDeviceToken()

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
                )
            } catch (error: Exception) {
                Log.e(
                    LOG_TAG,
                    "Failed to load local enrolment",
                    error,
                )

                _uiState.value =
                    HiveUiState(
                        isLoading = false,
                        isEnrolled = false,
                        error = readableError(error),
                    )
            }
        }
    }

    fun enrolDevice(
        enrollmentToken: String,
        assetId: String,
    ) {
        val cleanEnrollmentToken =
            enrollmentToken.trim()

        val cleanAssetId =
            assetId.trim()

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
                HiveUiState(
                    isLoading = true,
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
                    ApiClient.api.redeemEnrollment(
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

                tokenStorage.saveDeviceToken(
                    token = deviceToken,
                )

                /*
                 * Read the token back before making any other
                 * request or scheduling WorkManager.
                 */
                val storedToken =
                    tokenStorage.getDeviceToken()

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
    ) {
        try {
            Log.d(
                LOG_TAG,
                "Loading device from Hive",
            )

            val device =
                ApiClient.api.getDevice(
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
            if (
                error is HttpException &&
                error.code() == 401
            ) {
                Log.e(
                    LOG_TAG,
                    "Hive rejected the stored device token with HTTP 401",
                    error,
                )

                HeartbeatScheduler.cancel(
                    applicationContext,
                )

                tokenStorage.clearDeviceToken()

                Log.e(
                    LOG_TAG,
                    "Invalid device token removed from local storage",
                )
            } else {
                Log.e(
                    LOG_TAG,
                    "Could not load device from Hive",
                    error,
                )
            }

            _uiState.value =
                HiveUiState(
                    isLoading = false,
                    isEnrolled = false,
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
        return when (error) {
            is HttpException -> {
                when (error.code()) {
                    400 ->
                        "The enrolment request was rejected."

                    401 ->
                        "Hive rejected the device token."

                    404 ->
                        "The enrolment token or device was not found."

                    409 ->
                        "This device may already be enrolled."

                    410 ->
                        "The enrolment token has expired or was revoked."

                    422 ->
                        "Hive could not validate the device information."

                    else ->
                        "Hive returned HTTP ${error.code()}."
                }
            }

            else ->
                error.message
                    ?: "Unable to connect to Hive."
        }
    }

    companion object {
        private const val LOG_TAG =
            "HiveHeartbeat"
    }
}