package com.blackbird.hiveagent.commands

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.content.ContextCompat
import com.blackbird.hiveagent.api.CommandExecutionResult
import com.blackbird.hiveagent.api.DeviceCommand
import com.blackbird.hiveagent.api.DeviceLocationUpload
import com.blackbird.hiveagent.api.HiveApiClient
import com.blackbird.hiveagent.api.InstalledApplicationUpload
import com.blackbird.hiveagent.notifications.NotificationHelper
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import java.time.Instant
import kotlin.coroutines.resume

class CommandProcessor(
    private val context: Context,
    private val apiClient: HiveApiClient,
) {
    private val notificationHelper =
        NotificationHelper(context)

    private val locationManager =
        context.getSystemService(
            Context.LOCATION_SERVICE,
        ) as LocationManager

    suspend fun execute(
        command: DeviceCommand,
        deviceToken: String,
    ): CommandExecutionResult {
        return when (command.command.uppercase()) {
            "SYNC" -> success(
                "Device synchronisation completed.",
            )

            "PING" -> success(
                "Pong received from Hive Agent.",
            )

            "RING" -> executeRing()

            "SHOW_MESSAGE" -> executeShowMessage(command)

            "REFRESH_APPS" -> executeRefreshApps(deviceToken)
            "LAUNCH_APP" -> executeLaunchApp(command)
            "FORCE_STOP_APP" -> executeForceStopApp(command)
            "UNINSTALL_APP" -> executeUninstallApp(command)
            "REQUEST_LOCATION" -> executeRequestLocation(
                deviceToken = deviceToken,
            )

            "LOCK_DEVICE" -> failure(
                "LOCK_DEVICE requires Android device-owner " +
                    "or device-admin provisioning.",
            )

            else -> failure(
                "Unsupported command: ${command.command}",
            )
        }
    }

    private suspend fun executeRequestLocation(
        deviceToken: String,
    ): CommandExecutionResult {
        if (!hasLocationPermission()) {
            return failure(
                "Location permission has not been granted.",
            )
        }

        if (!isLocationEnabled()) {
            return failure(
                "Location services are disabled on the device.",
            )
        }

        return try {
            val location = getCurrentLocation()
                ?: return failure(
                    "Unable to obtain the device location.",
                )

            val payload = DeviceLocationUpload(
                latitude = location.latitude,
                longitude = location.longitude,
                accuracy = location.accuracy
                    .takeIf { location.hasAccuracy() },
                altitude = location.altitude
                    .takeIf { location.hasAltitude() },
                speed = location.speed
                    .takeIf { location.hasSpeed() },
                bearing = location.bearing
                    .takeIf { location.hasBearing() },
                provider = location.provider,
                recordedAt = Instant.ofEpochMilli(
                    location.time,
                ).toString(),
            )

            apiClient.uploadLocation(
                deviceToken = deviceToken,
                payload = payload,
            )

            success(
                "Device location uploaded successfully.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to upload the device location.",
            )
        }
    }

    private fun hasLocationPermission(): Boolean {
        val fineLocationGranted =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        val coarseLocationGranted =
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        return fineLocationGranted ||
            coarseLocationGranted
    }

    private fun isLocationEnabled(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            locationManager.isLocationEnabled
        } else {
            @Suppress("DEPRECATION")
            locationManager.isProviderEnabled(
                LocationManager.GPS_PROVIDER,
            ) || locationManager.isProviderEnabled(
                LocationManager.NETWORK_PROVIDER,
            )
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun getCurrentLocation(): Location? {
        val providers = buildList {
            if (
                locationManager.isProviderEnabled(
                    LocationManager.GPS_PROVIDER,
                )
            ) {
                add(LocationManager.GPS_PROVIDER)
            }

            if (
                locationManager.isProviderEnabled(
                    LocationManager.NETWORK_PROVIDER,
                )
            ) {
                add(LocationManager.NETWORK_PROVIDER)
            }
        }

        if (providers.isEmpty()) {
            return null
        }

        for (provider in providers) {
            val currentLocation =
                requestLocationFromProvider(provider)

            if (currentLocation != null) {
                return currentLocation
            }
        }

        return providers
            .mapNotNull { provider ->
                locationManager.getLastKnownLocation(
                    provider,
                )
            }
            .maxByOrNull { location ->
                location.time
            }
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestLocationFromProvider(
        provider: String,
    ): Location? {
        return if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
        ) {
            suspendCancellableCoroutine { continuation ->
                val cancellationSignal =
                    CancellationSignal()

                continuation.invokeOnCancellation {
                    cancellationSignal.cancel()
                }

                locationManager.getCurrentLocation(
                    provider,
                    cancellationSignal,
                    context.mainExecutor,
                ) { location ->
                    if (continuation.isActive) {
                        continuation.resume(location)
                    }
                }
            }
        } else {
            requestLegacyLocation(provider)
        }
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestLegacyLocation(
        provider: String,
    ): Location? {
        return suspendCancellableCoroutine { continuation ->
            val listener =
                object : android.location.LocationListener {
                    override fun onLocationChanged(
                        location: Location,
                    ) {
                        locationManager.removeUpdates(this)

                        if (continuation.isActive) {
                            continuation.resume(location)
                        }
                    }

                    @Deprecated(
                        "Deprecated in Android",
                    )
                    override fun onStatusChanged(
                        provider: String?,
                        status: Int,
                        extras: android.os.Bundle?,
                    ) = Unit

                    override fun onProviderEnabled(
                        provider: String,
                    ) = Unit

                    override fun onProviderDisabled(
                        provider: String,
                    ) {
                        locationManager.removeUpdates(this)

                        if (continuation.isActive) {
                            continuation.resume(null)
                        }
                    }
                }

            continuation.invokeOnCancellation {
                locationManager.removeUpdates(listener)
            }

            locationManager.requestSingleUpdate(
                provider,
                listener,
                Looper.getMainLooper(),
            )
        }
    }

    private suspend fun executeRing(): CommandExecutionResult {
        val alarmUri =
            RingtoneManager.getDefaultUri(
                RingtoneManager.TYPE_ALARM,
            ) ?: RingtoneManager.getDefaultUri(
                RingtoneManager.TYPE_RINGTONE,
            )

        val ringtone = alarmUri?.let { uri ->
            RingtoneManager.getRingtone(
                context,
                uri,
            )
        }

        if (ringtone == null) {
            return failure(
                "No alarm or ringtone was available on the device.",
            )
        }

        return try {
            ringtone.audioAttributes =
                AudioAttributes.Builder()
                    .setUsage(
                        AudioAttributes.USAGE_ALARM,
                    )
                    .setContentType(
                        AudioAttributes.CONTENT_TYPE_SONIFICATION,
                    )
                    .build()

            val vibrator = getVibrator()

            vibrator?.vibrate(
                VibrationEffect.createWaveform(
                    longArrayOf(
                        0L,
                        750L,
                        250L,
                        750L,
                        250L,
                    ),
                    0,
                ),
            )

            ringtone.play()

            delay(30_000L)

            ringtone.stop()
            vibrator?.cancel()

            success(
                "Device rang for 30 seconds.",
            )
        } catch (exception: Exception) {
            ringtone.stop()
            getVibrator()?.cancel()

            failure(
                exception.message
                    ?: "Unable to ring the device.",
            )
        }
    }

    private fun getVibrator(): Vibrator? {
        return if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        ) {
            val vibratorManager =
                context.getSystemService(
                    VibratorManager::class.java,
                )

            vibratorManager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(
                Context.VIBRATOR_SERVICE,
            ) as? Vibrator
        }
    }

    private fun executeShowMessage(
        command: DeviceCommand,
    ): CommandExecutionResult {
        val title = command.payload["title"]
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: "Hive message"

        val message = command.payload["message"]
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: return failure(
                "SHOW_MESSAGE payload did not contain a message.",
            )

        return if (
            notificationHelper.showMessage(
                title = title,
                message = message,
            )
        ) {
            success(
                "Message displayed successfully.",
            )
        } else {
            failure(
                "Notification permission has not been granted.",
            )
        }
    }

    private fun commandPackageName(
        command: DeviceCommand,
    ): String? =
        command.payload["package_name"]
            ?.toString()
            ?.trim()
            ?.takeIf { it.isNotEmpty() }

    private fun executeLaunchApp(
        command: DeviceCommand,
    ): CommandExecutionResult {
        val packageName =
            commandPackageName(command)
                ?: return failure(
                    "LAUNCH_APP payload did not contain package_name.",
                )

        return try {
            val launchIntent =
                context.packageManager
                    .getLaunchIntentForPackage(packageName)
                    ?: return failure(
                        "No launchable activity was found for $packageName.",
                    )

            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK,
            )
            context.startActivity(launchIntent)

            success(
                "Launch request sent for $packageName.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to launch $packageName.",
            )
        }
    }

    private fun executeForceStopApp(
        command: DeviceCommand,
    ): CommandExecutionResult {
        val packageName =
            commandPackageName(command)
                ?: return failure(
                    "FORCE_STOP_APP payload did not contain package_name.",
                )

        if (packageName == context.packageName) {
            return failure(
                "Hive Agent cannot force stop itself.",
            )
        }

        return failure(
            "Force stop is unavailable to a standard Android app. " +
                "It requires privileged system/OEM management. " +
                "No action was taken for $packageName.",
        )
    }

    private fun executeUninstallApp(
        command: DeviceCommand,
    ): CommandExecutionResult {
        val packageName =
            commandPackageName(command)
                ?: return failure(
                    "UNINSTALL_APP payload did not contain package_name.",
                )

        if (packageName == context.packageName) {
            return failure(
                "Hive Agent cannot uninstall itself remotely.",
            )
        }

        return try {
            @Suppress("DEPRECATION")
            val packageInfo =
                context.packageManager.getPackageInfo(
                    packageName,
                    0,
                )

            val applicationInfo =
                packageInfo.applicationInfo

            val isSystemApp =
                applicationInfo != null &&
                    (
                        applicationInfo.flags and
                            android.content.pm.ApplicationInfo.FLAG_SYSTEM
                    ) != 0

            if (isSystemApp) {
                return failure(
                    "System applications cannot be uninstalled by Hive Agent.",
                )
            }

            val uninstallIntent =
                Intent(
                    Intent.ACTION_DELETE,
                    Uri.parse("package:$packageName"),
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }

            context.startActivity(uninstallIntent)

            success(
                "Android uninstall confirmation opened for $packageName. " +
                    "User confirmation is required on this non-device-owner device.",
            )
        } catch (
            exception: PackageManager.NameNotFoundException
        ) {
            failure(
                "Package $packageName is no longer installed.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to request uninstall for $packageName.",
            )
        }
    }
    private suspend fun executeRefreshApps(
        deviceToken: String,
    ): CommandExecutionResult {
        return try {
            val packageManager = context.packageManager

            @Suppress("DEPRECATION")
            val packages =
                packageManager.getInstalledPackages(0)

            val applications =
                packages.map { packageInfo ->
                    val applicationInfo =
                        packageInfo.applicationInfo

                    val isSystemApp =
                        applicationInfo != null &&
                        (
                            applicationInfo.flags and
                                android.content.pm.ApplicationInfo.FLAG_SYSTEM
                        ) != 0

                    val appName =
                        applicationInfo
                            ?.loadLabel(packageManager)
                            ?.toString()
                            ?.trim()
                            ?.takeIf { it.isNotEmpty() }

                    val versionCode =
                        if (
                            Build.VERSION.SDK_INT >=
                                Build.VERSION_CODES.P
                        ) {
                            packageInfo.longVersionCode
                        } else {
                            @Suppress("DEPRECATION")
                            packageInfo.versionCode.toLong()
                        }

                    InstalledApplicationUpload(
                        packageName =
                            packageInfo.packageName,
                        appName = appName,
                        versionName =
                            packageInfo.versionName,
                        versionCode = versionCode,
                        isSystemApp = isSystemApp,
                        isEnabled =
                            applicationInfo?.enabled
                                ?: true,
                        firstInstalledAt =
                            packageInfo.firstInstallTime
                                .takeIf { it > 0L }
                                ?.let {
                                    java.time.Instant
                                        .ofEpochMilli(it)
                                        .toString()
                                },
                        lastUpdatedAt =
                            packageInfo.lastUpdateTime
                                .takeIf { it > 0L }
                                ?.let {
                                    java.time.Instant
                                        .ofEpochMilli(it)
                                        .toString()
                                },
                    )
                }
                .sortedBy {
                    it.appName
                        ?: it.packageName
                }

            val response =
                apiClient.uploadInstalledApplications(
                    deviceToken = deviceToken,
                    applications = applications,
                )

            success(
                "Uploaded ${response.applicationCount} installed applications.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to refresh installed applications.",
            )
        }
    }

    private fun success(
        message: String,
    ) = CommandExecutionResult(
        successful = true,
        message = message,
    )

    private fun failure(
        message: String,
    ) = CommandExecutionResult(
        successful = false,
        message = message,
    )
}


