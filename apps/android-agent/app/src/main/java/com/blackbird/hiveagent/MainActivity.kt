package com.blackbird.hiveagent

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.blackbird.hiveagent.ui.theme.HiveAgentTheme

class MainActivity : ComponentActivity() {

    private val locationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions(),
        ) { permissions ->
            val fineLocationGranted =
                permissions[
                    Manifest.permission.ACCESS_FINE_LOCATION
                ] == true

            val coarseLocationGranted =
                permissions[
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ] == true

            if (fineLocationGranted || coarseLocationGranted) {
                requestBackgroundLocationPermission()
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        requestForegroundLocationPermission()

        setContent {
            HiveAgentTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    HiveAgentScreen()
                }
            }
        }
    }

    private fun requestForegroundLocationPermission() {
        val fineLocationGranted =
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        val coarseLocationGranted =
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ) == PackageManager.PERMISSION_GRANTED

        if (fineLocationGranted || coarseLocationGranted) {
            requestBackgroundLocationPermission()
            return
        }

        locationPermissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
        )
    }

    private fun requestBackgroundLocationPermission() {
        // Background location is requested separately in the next step.
    }
}

@Composable
fun HiveAgentScreen(
    hiveViewModel: HiveViewModel = viewModel(),
) {
    val uiState by hiveViewModel.uiState.collectAsState()
    LaunchedEffect(Unit) {
        hiveViewModel.loadDevice()
    }

    when {
        uiState.isLoading -> {
            LoadingScreen()
        }

        uiState.isEnrolled &&
            uiState.device != null -> {
            ManagedDeviceScreen(
                uiState = uiState,
                onSync = hiveViewModel::loadDevice,
                onClearEnrolment =
                    hiveViewModel::clearEnrolment,
            )
        }

        else -> {
            EnrolmentScreen(
                error = uiState.error,
                isEnrolling = uiState.isEnrolling,
                onEnrol = hiveViewModel::enrolDevice,
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(
        modifier =
            Modifier
                .fillMaxSize()
                .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment =
                Alignment.CenterHorizontally,
            verticalArrangement =
                Arrangement.spacedBy(16.dp),
        ) {
            CircularProgressIndicator()

            Text(
                text = "Connecting to Hive...",
                style =
                    MaterialTheme.typography.bodyLarge,
            )
        }
    }
}

@Composable
private fun EnrolmentScreen(
    error: String?,
    isEnrolling: Boolean,
    onEnrol: (
        enrollmentToken: String,
        assetId: String,
    ) -> Unit,
) {
    var enrollmentToken by rememberSaveable {
        mutableStateOf("")
    }

    var assetId by rememberSaveable {
        mutableStateOf("")
    }

    val context = LocalContext.current

    val detectedSerial =
        remember {
            Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ANDROID_ID,
            ) ?: "Unknown"
        }

    val detectedManufacturer =
        remember {
            Build.MANUFACTURER
                .ifBlank { "Unknown" }
        }

    val detectedModel =
        remember {
            Build.MODEL
                .ifBlank { "Unknown" }
        }

    val detectedAndroidVersion =
        remember {
            Build.VERSION.RELEASE
                ?.ifBlank { "Unknown" }
                ?: "Unknown"
        }

    val canSubmit =
        enrollmentToken.trim().length >= 10 &&
            assetId.isNotBlank() &&
            !isEnrolling

    Scaffold { innerPadding ->
        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 24.dp),
            verticalArrangement =
                Arrangement.Center,
        ) {
            item {
                Text(
                    text = "Hive",
                    style =
                        MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                )

                Text(
                    text = "Device Agent",
                    style =
                        MaterialTheme.typography.titleLarge,
                    color =
                        MaterialTheme.colorScheme
                            .onSurfaceVariant,
                )

                Spacer(
                    modifier = Modifier.height(12.dp),
                )

                Text(
                    text =
                        "Enrol this device to connect it " +
                            "securely to your Hive organisation.",
                    style =
                        MaterialTheme.typography.bodyLarge,
                )

                Spacer(
                    modifier = Modifier.height(32.dp),
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
                    supportingText = {
                        Text(
                            "Enter the token generated in Hive.",
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isEnrolling,
                    singleLine = true,
                    keyboardOptions =
                        KeyboardOptions(
                            capitalization =
                                KeyboardCapitalization
                                    .Characters,
                        ),
                )

                Spacer(
                    modifier = Modifier.height(16.dp),
                )

                OutlinedTextField(
                    value = assetId,
                    onValueChange = {
                        assetId =
                            it.uppercase()
                    },
                    label = {
                        Text("Asset ID")
                    },
                    supportingText = {
                        Text(
                            "For example: LB164 or EA660-042.",
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !isEnrolling,
                    singleLine = true,
                    keyboardOptions =
                        KeyboardOptions(
                            capitalization =
                                KeyboardCapitalization
                                    .Characters,
                        ),
                )

                Spacer(
                    modifier = Modifier.height(24.dp),
                )

                Text(
                    text = "Detected device",
                    style =
                        MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )

                Spacer(
                    modifier = Modifier.height(12.dp),
                )

                DetailsCard(
                    rows =
                        listOf(
                            DetailRow(
                                label = "Manufacturer",
                                value = detectedManufacturer,
                            ),
                            DetailRow(
                                label = "Model",
                                value = detectedModel,
                            ),
                            DetailRow(
                                label = "Android",
                                value = detectedAndroidVersion,
                            ),
                            DetailRow(
                                label = "Device identifier",
                                value = detectedSerial,
                            ),
                        ),
                )

                if (!error.isNullOrBlank()) {
                    Spacer(
                        modifier = Modifier.height(16.dp),
                    )

                    ErrorCard(
                        message = error,
                    )
                }

                Spacer(
                    modifier = Modifier.height(24.dp),
                )

                Button(
                    onClick = {
                        onEnrol(
                            enrollmentToken,
                            assetId,
                        )
                    },
                    modifier = Modifier.fillMaxWidth(),
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
                                Modifier.padding(horizontal = 6.dp),
                        )

                        Text("Enrolling...")
                    } else {
                        Text("Enrol device")
                    }
                }

                Spacer(
                    modifier = Modifier.height(24.dp),
                )

                Text(
                    text =
                        "After enrolment, Hive will securely " +
                            "manage this device in the background.",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                    style =
                        MaterialTheme.typography.bodySmall,
                    color =
                        MaterialTheme.colorScheme
                            .onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun ManagedDeviceScreen(
    uiState: HiveUiState,
    onSync: () -> Unit,
    onClearEnrolment: () -> Unit,
) {
    val device = uiState.device ?: return

    var showDiagnostics by rememberSaveable {
        mutableStateOf(false)
    }

    var showRemoveConfirmation by remember {
        mutableStateOf(false)
    }

    if (showRemoveConfirmation) {
        RemoveEnrolmentDialog(
            assetId = device.asset_id,
            onDismiss = {
                showRemoveConfirmation = false
            },
            onConfirm = {
                showRemoveConfirmation = false
                onClearEnrolment()
            },
        )
    }

    Scaffold { innerPadding ->
        LazyColumn(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 20.dp),
            verticalArrangement =
                Arrangement.spacedBy(16.dp),
        ) {
            item {
                Spacer(
                    modifier = Modifier.height(8.dp),
                )

                Text(
                    text = "Hive",
                    style =
                        MaterialTheme.typography.displaySmall,
                    fontWeight = FontWeight.Bold,
                )

                Text(
                    text = "Device Agent",
                    style =
                        MaterialTheme.typography.titleMedium,
                    color =
                        MaterialTheme.colorScheme
                            .onSurfaceVariant,
                )
            }

            item {
                ConnectionCard(
                    assetId = device.asset_id,
                    lastSeen = device.last_seen_at,
                )
            }

            item {
                SectionHeading(
                    title = "Managed device",
                )
            }

            item {
                DetailsCard(
                    rows =
                        listOf(
                            DetailRow(
                                label = "Asset ID",
                                value = device.asset_id,
                            ),
                            DetailRow(
                                label = "Hive ID",
                                value = device.hive_id,
                            ),
                          DetailRow(
    label = "Manufacturer",
    value =
        device.manufacturer
            ?.ifBlank {
                "Unknown"
            }
            ?: "Unknown",
),
DetailRow(
    label = "Model",
    value =
        device.model
            ?.ifBlank {
                "Unknown"
            }
            ?: "Unknown",
),
DetailRow(
    label = "Android",
    value =
        device.android_version
            ?: "Unknown",
),
                        ),
                )
            }

            item {
                SectionHeading(
                    title = "Device health",
                )
            }

            item {
                DetailsCard(
                    rows =
                        listOf(
                            DetailRow(
                                label = "Battery",
                                value =
                                    device.battery_level
                                        ?.let { "$it%" }
                                        ?: "Unknown",
                            ),
                            DetailRow(
                                label = "Wi-Fi",
                                value =
                                    device.wifi_ssid
                                        ?: "Unknown",
                            ),
                            DetailRow(
                                label = "Last heartbeat",
                                value =
                                    device.last_seen_at
                                        ?: "Not available",
                            ),
                        ),
                )
            }

            if (!uiState.error.isNullOrBlank()) {
                item {
                    ErrorCard(
                        message = uiState.error,
                    )
                }
            }

            item {
                Button(
                    onClick = onSync,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Sync now")
                }
            }

            item {
                OutlinedButton(
                    onClick = {
                        showDiagnostics =
                            !showDiagnostics
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        if (showDiagnostics) {
                            "Hide diagnostics"
                        } else {
                            "View diagnostics"
                        },
                    )
                }
            }

            if (showDiagnostics) {
                item {
                    SectionHeading(
                        title = "Diagnostics",
                    )
                }

                item {
                    DetailsCard(
                        rows =
                            listOf(
                                DetailRow(
    label = "Serial",
    value =
        device.serial_number
            ?.ifBlank {
                "Unknown"
            }
            ?: "Unknown",
                           ),
                                DetailRow(
                                    label = "Connection",
                                    value = "Authenticated",
                                ),
                                DetailRow(
                                    label = "Heartbeat",
                                    value =
                                        "Scheduled every " +
                                            "15 minutes",
                                ),
                                DetailRow(
                                    label = "Management",
                                    value =
                                        "Managed by Hive",
                                ),
                            ),
                    )
                }

                item {
                    TextButton(
                        onClick = {
                            showRemoveConfirmation = true
                        },
                        modifier =
                            Modifier.fillMaxWidth(),
                    ) {
                        Text("Remove local enrolment")
                    }
                }
            }

            item {
                Spacer(
                    modifier = Modifier.height(8.dp),
                )

                Text(
                    text = "Managed securely by Hive",
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center,
                    style =
                        MaterialTheme.typography.bodySmall,
                    color =
                        MaterialTheme.colorScheme
                            .onSurfaceVariant,
                )

                Spacer(
                    modifier = Modifier.height(20.dp),
                )
            }
        }
    }
}

@Composable
private fun ConnectionCard(
    assetId: String,
    lastSeen: String?,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors =
            CardDefaults.cardColors(
                containerColor =
                    MaterialTheme.colorScheme
                        .primaryContainer,
            ),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement =
                Arrangement.spacedBy(8.dp),
        ) {
            Text(
                text = "CONNECTED",
                style =
                    MaterialTheme.typography.labelLarge,
                color =
                    MaterialTheme.colorScheme
                        .onPrimaryContainer,
                fontWeight = FontWeight.Bold,
            )

            Text(
                text = assetId,
                style =
                    MaterialTheme.typography
                        .headlineMedium,
                fontWeight = FontWeight.Bold,
            )

            Text(
                text =
                    if (lastSeen.isNullOrBlank()) {
                        "Waiting for heartbeat information"
                    } else {
                        "Last heartbeat: $lastSeen"
                    },
                style =
                    MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

private data class DetailRow(
    val label: String,
    val value: String,
)

@Composable
private fun DetailsCard(
    rows: List<DetailRow>,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
        ) {
            rows.forEachIndexed { index, row ->
                DeviceDetailRow(
                    label = row.label,
                    value = row.value,
                )

                if (index < rows.lastIndex) {
                    HorizontalDivider(
                        modifier =
                            Modifier.padding(
                                vertical = 12.dp,
                            ),
                    )
                }
            }
        }
    }
}

@Composable
private fun DeviceDetailRow(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement =
            Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style =
                MaterialTheme.typography.bodyMedium,
            color =
                MaterialTheme.colorScheme
                    .onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )

        Text(
            text = value,
            style =
                MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(1.3f),
        )
    }
}

@Composable
private fun SectionHeading(
    title: String,
) {
    Text(
        text = title,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
    )
}

@Composable
private fun ErrorCard(
    message: String,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors =
            CardDefaults.cardColors(
                containerColor =
                    MaterialTheme.colorScheme
                        .errorContainer,
            ),
    ) {
        Text(
            text = message,
            modifier = Modifier.padding(16.dp),
            color =
                MaterialTheme.colorScheme
                    .onErrorContainer,
        )
    }
}

@Composable
private fun RemoveEnrolmentDialog(
    assetId: String,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("Remove enrolment?")
        },
        text = {
            Text(
                "This will remove the local Hive token " +
                    "from $assetId and stop its heartbeat. " +
                    "The device record will remain in Hive.",
            )
        },
        confirmButton = {
            Button(
                onClick = onConfirm,
            ) {
                Text("Remove")
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
            ) {
                Text("Cancel")
            }
        },
    )
}