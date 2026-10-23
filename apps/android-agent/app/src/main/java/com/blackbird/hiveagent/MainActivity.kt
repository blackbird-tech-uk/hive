package com.blackbird.hiveagent

import android.Manifest
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.ContextCompat.startForegroundService
import androidx.lifecycle.viewmodel.compose.viewModel
import com.blackbird.hiveagent.service.CommandPollingService
import com.blackbird.hiveagent.ui.theme.HiveAgentTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(
        savedInstanceState: Bundle?,
    ) {
        super.onCreate(savedInstanceState)

        setContent {
            HiveAgentTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color =
                        MaterialTheme.colorScheme.background,
                ) {
                    HiveAgentScreen()
                }
            }
        }
    }
}

@Composable
fun HiveAgentScreen(
    hiveViewModel: HiveViewModel = viewModel(),
) {
    val uiState by
        hiveViewModel.uiState.collectAsState()

    val context = LocalContext.current

    val adminComponent = ComponentName(
        context,
        HiveDeviceAdminReceiver::class.java,
    )

    var isDeviceAdminActive by rememberSaveable {
        mutableStateOf(
            (context.getSystemService(
                android.content.Context.DEVICE_POLICY_SERVICE,
            ) as DevicePolicyManager).isAdminActive(adminComponent),
        )
    }

    val deviceAdminLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.StartActivityForResult(),
        ) {
            val policyManager =
                context.getSystemService(
                    android.content.Context.DEVICE_POLICY_SERVICE,
                ) as DevicePolicyManager

            isDeviceAdminActive =
                policyManager.isAdminActive(adminComponent)

            hiveViewModel.loadDevice()

            if (uiState.isEnrolled) {
                startForegroundService(
                    context,
                    Intent(
                        context,
                        CommandPollingService::class.java,
                    ),
                )
            }
        }

    val locationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts
                .RequestPermission(),
        ) { }

    val notificationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts
                .RequestPermission(),
        ) { }

    LaunchedEffect(Unit) {
        if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission
                    .ACCESS_FINE_LOCATION,
            ) != PackageManager
                .PERMISSION_GRANTED
        ) {
            locationPermissionLauncher.launch(
                Manifest.permission
                    .ACCESS_FINE_LOCATION,
            )
        }
    }

    LaunchedEffect(Unit) {
        if (
            Build.VERSION.SDK_INT >=
                Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPermissionLauncher.launch(
                Manifest.permission.POST_NOTIFICATIONS,
            )
        }
    }

    LaunchedEffect(Unit) {
        hiveViewModel.loadDevice()
    }

    LaunchedEffect(uiState.isEnrolled) {
        val serviceIntent = Intent(
            context,
            CommandPollingService::class.java,
        )

        if (uiState.isEnrolled) {
            startForegroundService(
                context,
                serviceIntent,
            )
        } else {
            context.stopService(serviceIntent)
        }
    }

    when {
        uiState.isLoading -> {
            LoadingScreen()
        }

        uiState.isEnrolled &&
            uiState.device != null -> {
            EnrolledDeviceScreen(
                uiState = uiState,
                onRefresh =
                    hiveViewModel::loadDevice,
                onClearEnrolment =
                    hiveViewModel::clearEnrolment,
                isDeviceAdminActive =
                    isDeviceAdminActive,
                onActivateDeviceAdmin = {
                    val intent = Intent(
                        DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN,
                    ).apply {
                        putExtra(
                            DevicePolicyManager.EXTRA_DEVICE_ADMIN,
                            adminComponent,
                        )
                        putExtra(
                            DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                            "Allow Hive to securely lock this managed device.",
                        )
                    }

                    deviceAdminLauncher.launch(intent)
                },            )
        }

        uiState.hasStoredEnrolment -> {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(24.dp),
                verticalArrangement = Arrangement.Center,
            ) {
                Text("Scanner enrolment saved")
                Text(
                    uiState.error
                        ?: "Hive could not validate this scanner. Check the connection.",
                )
                Button(onClick = hiveViewModel::loadDevice) {
                    Text("Retry connection")
                }
                OutlinedButton(onClick = hiveViewModel::clearEnrolment) {
                    Text("Remove enrolment")
                }
            }
        }

        else -> {
            EnrolmentScreen(
    error = uiState.error,
    isEnrolling =
        uiState.isEnrolling,
    onEnrol =
        hiveViewModel::enrolDevice,
)
            
        }
    }
}

@Composable
private fun LoadingScreen() {
    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        verticalArrangement =
            Arrangement.Center,
    ) {
        CircularProgressIndicator()

        Spacer(
            modifier =
                Modifier.height(16.dp),
        )

        Text("Connecting to Hiveâ€¦")
    }
}

@Composable
private fun EnrolmentScreen(
    error: String?,
    isEnrolling: Boolean,
    onEnrol: (
    enrollmentToken: String,
    assetId: String,
    serverUrl: String?,
) -> Unit,
) {
    var enrollmentToken by
        rememberSaveable {
            mutableStateOf("")
        }

    var assetId by
        rememberSaveable {
            mutableStateOf("")
        }

    var showQrScanner by
        rememberSaveable {
            mutableStateOf(false)
        }

    var scannedServerUrl by
        rememberSaveable {
            mutableStateOf<String?>(null)
        }

    if (showQrScanner) {
        QrScannerScreen(
            onCodeScanned = { enrollment ->
                enrollmentToken =
                    enrollment.token

                scannedServerUrl =
                    enrollment.serverUrl

                showQrScanner = false
            },
            onCancel = {
                showQrScanner = false
            },
        )

        return
    }

    val canSubmit =
        enrollmentToken
            .trim()
            .length >= 10 &&
            assetId.isNotBlank() &&
            !isEnrolling

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        verticalArrangement =
            Arrangement.Center,
    ) {
        Text(
            text = "Hive Agent",
            style =
                MaterialTheme.typography
                    .headlineMedium,
        )

        Spacer(
            modifier =
                Modifier.height(8.dp),
        )

        Text(
            text =
                "Enrol this device into Hive.",
        )

        Spacer(
            modifier =
                Modifier.height(24.dp),
        )

        OutlinedTextField(
            value = enrollmentToken,
            onValueChange = {
                enrollmentToken =
                    it.uppercase()
            },
            label = {
                Text("Enrolment token")
            },
            modifier =
                Modifier.fillMaxWidth(),
            enabled = !isEnrolling,
            singleLine = true,
            keyboardOptions =
                KeyboardOptions(
                    capitalization =
                        KeyboardCapitalization
                            .Characters,
                ),
        )

        OutlinedButton(
            modifier =
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
            enabled = !isEnrolling,
            onClick = {
                showQrScanner = true
            },
        ) {
            Text("Scan enrollment QR")
        }

        if (!scannedServerUrl.isNullOrBlank()) {
            Text(
                text =
                    "QR server: $scannedServerUrl",
                modifier =
                    Modifier.padding(top = 8.dp),
                style =
                    MaterialTheme.typography
                        .bodySmall,
                color =
                    MaterialTheme.colorScheme
                        .onSurfaceVariant,
            )
        }

        Spacer(
            modifier =
                Modifier.height(16.dp),
        )

        OutlinedTextField(
            value = assetId,
            onValueChange = {
                assetId = it.uppercase()
            },
            label = {
                Text("Asset ID")
            },
            modifier =
                Modifier.fillMaxWidth(),
            enabled = !isEnrolling,
            singleLine = true,
            keyboardOptions =
                KeyboardOptions(
                    capitalization =
                        KeyboardCapitalization
                            .Characters,
                ),
        )

        if (!error.isNullOrBlank()) {
            Spacer(
                modifier =
                    Modifier.height(16.dp),
            )

            Card(
                modifier =
                    Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = error,
                    modifier =
                        Modifier.padding(16.dp),
                    color =
                        MaterialTheme.colorScheme
                            .error,
                )
            }
        }

        Spacer(
            modifier =
                Modifier.height(24.dp),
        )

        Button(
            onClick = {
                onEnrol(
    enrollmentToken,
    assetId,
    scannedServerUrl,
)
            },
            modifier =
                Modifier.fillMaxWidth(),
            enabled = canSubmit,
        ) {
            if (isEnrolling) {
                CircularProgressIndicator(
                    modifier =
                        Modifier.height(20.dp),
                    strokeWidth = 2.dp,
                )

                Spacer(
                    modifier =
                        Modifier.padding(
                            horizontal = 6.dp,
                        ),
                )

                Text("Enrollingâ€¦")
            } else {
                Text("Enrol device")
            }
        }
    }
}

@Composable
private fun EnrolledDeviceScreen(
    uiState: HiveUiState,
    onRefresh: () -> Unit,
    onClearEnrolment: () -> Unit,
    isDeviceAdminActive: Boolean,
    onActivateDeviceAdmin: () -> Unit,
) {
    val device =
        uiState.device ?: return

    Column(
        modifier =
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
        verticalArrangement =
            Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = "Hive Agent",
            style =
                MaterialTheme.typography
                    .headlineMedium,
        )

        Card(
            modifier =
                Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier =
                    Modifier.padding(16.dp),
                verticalArrangement =
                    Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Connected to Hive",
                    style =
                        MaterialTheme.typography
                            .titleMedium,
                )

                Text(
                    "Hive ID: ${device.hive_id}",
                )

                Text(
                    "Asset ID: ${device.asset_id}",
                )

                Text(
                    "Serial: ${device.serial_number}",
                )

                Text(
                    "Manufacturer: ${
                        device.manufacturer
                            ?: "Unknown"
                    }",
                )

                Text(
                    "Model: ${device.model}",
                )

                Text(
                    "Android: ${
                        device.android_version
                            ?: "Unknown"
                    }",
                )

                Text(
                    "Battery: ${
                        device.battery_level
                            ?.let { "$it%" }
                            ?: "Unknown"
                    }",
                )

                Text(
                    "Wi-Fi: ${
                        device.wifi_ssid
                            ?: "Unknown"
                    }",
                )

                Text(
                    "Last seen: ${
                        device.last_seen_at
                            ?: "Unknown"
                    }",
                )
            }
        }

        Card(
            modifier =
                Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier =
                    Modifier.padding(16.dp),
                verticalArrangement =
                    Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = "Device management",
                    style =
                        MaterialTheme.typography
                            .titleMedium,
                )

                Text(
                    if (isDeviceAdminActive) {
                        "Device Admin is active. Hive can use supported management controls such as remote screen lock."
                    } else {
                        "Device Admin is not active. Enable it to allow supported Hive management controls without factory resetting this device."
                    },
                )

                if (!isDeviceAdminActive) {
                    Button(
                        onClick = onActivateDeviceAdmin,
                        modifier =
                            Modifier.fillMaxWidth(),
                    ) {
                        Text("Activate Device Admin")
                    }
                } else {
                    Text(
                        text = "Device Admin active",
                        color =
                            MaterialTheme.colorScheme
                                .primary,
                    )
                }
            }
        }

        Button(
            onClick = onRefresh,
            modifier =
                Modifier.fillMaxWidth(),
        ) {
            Text("Refresh")
        }

        OutlinedButton(
            onClick =
                onClearEnrolment,
            modifier =
                Modifier.fillMaxWidth(),
        ) {
            Text(
                "Remove local enrolment",
            )
        }
    }
}


