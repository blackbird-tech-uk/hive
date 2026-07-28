package com.blackbird.hiveagent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.blackbird.hiveagent.ui.theme.HiveAgentTheme
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            HiveAgentTheme {
                HiveAgentScreen()
            }
        }
    }
}

@Composable
fun HiveAgentScreen(
    hiveViewModel: HiveViewModel = viewModel()
) {
    val uiState by hiveViewModel.uiState.collectAsState()

    val context = LocalContext.current

    val locationPermissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission()
        ) { }

    LaunchedEffect(Unit) {
        if (
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            locationPermissionLauncher.launch(
                Manifest.permission.ACCESS_FINE_LOCATION
            )
        }
    }

    LaunchedEffect(Unit) {
        hiveViewModel.loadDevice()
    }

    when {
        uiState.isLoading -> {
            LoadingScreen()
        }

        uiState.isEnrolled && uiState.device != null -> {
            EnrolledDeviceScreen(
                uiState = uiState,
                onRefresh = hiveViewModel::loadDevice,
                onClearEnrolment = hiveViewModel::clearEnrolment
            )
        }

        else -> {
            EnrolmentScreen(
                error = uiState.error,
                onEnrol = hiveViewModel::enrolDevice
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()

        Spacer(
            modifier = Modifier.height(16.dp)
        )

        Text("Connecting to Hive…")
    }
}

@Composable
private fun EnrolmentScreen(
    error: String?,
    onEnrol: (
        enrollmentToken: String,
        assetId: String
    ) -> Unit
) {
    var enrollmentToken by remember {
        mutableStateOf("")
    }

    var assetId by remember {
        mutableStateOf("")
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "Hive Agent",
            style = MaterialTheme.typography.headlineMedium
        )

        Spacer(
            modifier = Modifier.height(8.dp)
        )

        Text(
            text = "Enrol this device into Hive."
        )

        Spacer(
            modifier = Modifier.height(24.dp)
        )

        OutlinedTextField(
            value = enrollmentToken,
            onValueChange = {
                enrollmentToken = it
            },
            label = {
                Text("Enrolment token")
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                capitalization =
                    KeyboardCapitalization.Characters
            )
        )

        Spacer(
            modifier = Modifier.height(16.dp)
        )

        OutlinedTextField(
            value = assetId,
            onValueChange = {
                assetId = it
            },
            label = {
                Text("Asset ID")
            },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(
                capitalization =
                    KeyboardCapitalization.Characters
            )
        )

        if (!error.isNullOrBlank()) {
            Spacer(
                modifier = Modifier.height(16.dp)
            )

            Card(
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = error,
                    modifier = Modifier.padding(16.dp)
                )
            }
        }

        Spacer(
            modifier = Modifier.height(24.dp)
        )

        Button(
            onClick = {
                onEnrol(
                    enrollmentToken,
                    assetId
                )
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Enrol Device")
        }
    }
}

@Composable
private fun EnrolledDeviceScreen(
    uiState: HiveUiState,
    onRefresh: () -> Unit,
    onClearEnrolment: () -> Unit
) {
    val device = uiState.device ?: return

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement =
            Arrangement.spacedBy(16.dp)
    ) {
        Text(
            text = "Hive Agent",
            style = MaterialTheme.typography.headlineMedium
        )

        Card(
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement =
                    Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = "Connected to Hive",
                    style =
                        MaterialTheme.typography.titleMedium
                )

                Text("Hive ID: ${device.hive_id}")
                Text("Asset ID: ${device.asset_id}")
                Text("Serial: ${device.serial_number}")
                Text("Manufacturer: ${device.manufacturer}")
                Text("Model: ${device.model}")
                Text(
                    "Android: ${
                        device.android_version
                            ?: "Unknown"
                    }"
                )
                Text(
                    "Battery: ${
                        device.battery_level?.let {
                            "$it%"
                        } ?: "Unknown"
                    }"
                )
                Text(
                    "Wi-Fi: ${
                        device.wifi_ssid ?: "Unknown"
                    }"
                )
                Text(
                    "Last seen: ${
                        device.last_seen_at ?: "Unknown"
                    }"
                )
            }
        }

        Button(
            onClick = onRefresh,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Refresh")
        }

        Button(
            onClick = onClearEnrolment,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Remove Local Enrolment")
        }
    }
}