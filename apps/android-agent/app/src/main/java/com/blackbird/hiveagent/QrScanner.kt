package com.blackbird.hiveagent

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

data class HiveEnrollmentQr(
    val token: String,
    val serverUrl: String?,
)

fun parseHiveEnrollmentQr(
    rawValue: String,
): HiveEnrollmentQr {
    val value = rawValue.trim()

    if (value.isBlank()) {
        throw IllegalArgumentException(
            "The QR code is empty.",
        )
    }

    /*
     * Allow a plaintext enrollment token as a
     * fallback for testing and older QR codes.
     */
    if (!value.startsWith("{")) {
        if (value.length < 10) {
            throw IllegalArgumentException(
                "This is not a valid Hive enrollment code.",
            )
        }

        return HiveEnrollmentQr(
            token = value.uppercase(),
            serverUrl = null,
        )
    }

    val json = JSONObject(value)

    val type =
        json.optString("type").trim()

    val version =
        json.optInt("version", 0)

    val token =
        json.optString("token")
            .trim()
            .uppercase()

    val serverUrl =
        json.optString("server_url")
            .trim()
            .ifBlank { null }

    if (type != "hive-enrollment") {
        throw IllegalArgumentException(
            "This QR code was not created by Hive.",
        )
    }

    if (version != 1) {
        throw IllegalArgumentException(
            "This Hive enrollment QR version is not supported.",
        )
    }

    if (token.length < 10) {
        throw IllegalArgumentException(
            "The enrollment token is missing or invalid.",
        )
    }

    return HiveEnrollmentQr(
        token = token,
        serverUrl = serverUrl,
    )
}

@Composable
fun QrScannerScreen(
    onCodeScanned: (HiveEnrollmentQr) -> Unit,
    onCancel: () -> Unit,
) {
    val context = LocalContext.current

    var cameraGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.CAMERA,
            ) == PackageManager.PERMISSION_GRANTED,
        )
    }

    val permissionLauncher =
        rememberLauncherForActivityResult(
            ActivityResultContracts.RequestPermission(),
        ) { granted ->
            cameraGranted = granted
        }

    LaunchedEffect(Unit) {
        if (!cameraGranted) {
            permissionLauncher.launch(
                Manifest.permission.CAMERA,
            )
        }
    }

    if (!cameraGranted) {
        Column(
            modifier =
                Modifier
                    .fillMaxSize()
                    .padding(24.dp),
            horizontalAlignment =
                Alignment.CenterHorizontally,
            verticalArrangement =
                Arrangement.Center,
        ) {
            Text(
                text = "Camera permission required",
                style =
                    MaterialTheme.typography
                        .headlineSmall,
            )

            Text(
                text =
                    "Hive needs camera access to scan " +
                        "the enrollment QR code.",
                modifier =
                    Modifier.padding(
                        vertical = 16.dp,
                    ),
            )

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = {
                    permissionLauncher.launch(
                        Manifest.permission.CAMERA,
                    )
                },
            ) {
                Text("Allow camera")
            }

            OutlinedButton(
                modifier =
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                onClick = onCancel,
            ) {
                Text("Cancel")
            }
        }

        return
    }

    Box(
        modifier = Modifier.fillMaxSize(),
    ) {
        HiveCameraPreview(
            onCodeScanned = onCodeScanned,
        )

        Column(
            modifier =
                Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth()
                    .padding(24.dp),
            horizontalAlignment =
                Alignment.CenterHorizontally,
        ) {
            Text(
                text =
                    "Point the camera at the Hive " +
                        "enrollment QR code.",
                color =
                    MaterialTheme.colorScheme
                        .onSurface,
                modifier =
                    Modifier.padding(
                        bottom = 12.dp,
                    ),
            )

            OutlinedButton(
                modifier = Modifier.fillMaxWidth(),
                onClick = onCancel,
            ) {
                Text("Cancel scanning")
            }
        }
    }
}

@OptIn(ExperimentalGetImage::class)
@Composable
private fun HiveCameraPreview(
    onCodeScanned: (HiveEnrollmentQr) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner =
        LocalLifecycleOwner.current

    val cameraExecutor = remember {
        Executors.newSingleThreadExecutor()
    }

    val scanner = remember {
        val options =
            BarcodeScannerOptions.Builder()
                .setBarcodeFormats(
                    Barcode.FORMAT_QR_CODE,
                )
                .build()

        BarcodeScanning.getClient(options)
    }

    val scanCompleted = remember {
        AtomicBoolean(false)
    }

    var cameraError by remember {
        mutableStateOf<String?>(null)
    }

    DisposableEffect(Unit) {
        onDispose {
            scanner.close()
            cameraExecutor.shutdown()
        }
    }

    Box(
        modifier = Modifier.fillMaxSize(),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { viewContext ->
                val previewView =
                    PreviewView(viewContext)

                val cameraProviderFuture =
                    ProcessCameraProvider.getInstance(
                        viewContext,
                    )

                cameraProviderFuture.addListener(
                    {
                        try {
                            val cameraProvider =
                                cameraProviderFuture.get()

                            val preview =
                                Preview.Builder()
                                    .build()
                                    .also {
                                        it.setSurfaceProvider(
                                            previewView
                                                .surfaceProvider,
                                        )
                                    }

                            val imageAnalysis =
                                ImageAnalysis.Builder()
                                    .setBackpressureStrategy(
                                        ImageAnalysis
                                            .STRATEGY_KEEP_ONLY_LATEST,
                                    )
                                    .build()

                            imageAnalysis.setAnalyzer(
                                cameraExecutor,
                            ) { imageProxy ->
                                val mediaImage =
                                    imageProxy.image

                                if (
                                    mediaImage == null ||
                                    scanCompleted.get()
                                ) {
                                    imageProxy.close()
                                    return@setAnalyzer
                                }

                                val inputImage =
                                    InputImage.fromMediaImage(
                                        mediaImage,
                                        imageProxy
                                            .imageInfo
                                            .rotationDegrees,
                                    )

                                scanner.process(inputImage)
                                    .addOnSuccessListener {
                                        barcodes ->
                                        val rawValue =
                                            barcodes
                                                .firstOrNull()
                                                ?.rawValue

                                        if (
                                            rawValue.isNullOrBlank() ||
                                            !scanCompleted
                                                .compareAndSet(
                                                    false,
                                                    true,
                                                )
                                        ) {
                                            return@addOnSuccessListener
                                        }

                                        try {
                                            val enrollment =
                                                parseHiveEnrollmentQr(
                                                    rawValue,
                                                )

                                            onCodeScanned(
                                                enrollment,
                                            )
                                        } catch (error: Exception) {
                                            cameraError =
                                                error.message
                                                    ?: "Invalid QR code."

                                            scanCompleted.set(
                                                false,
                                            )
                                        }
                                    }
                                    .addOnFailureListener {
                                        cameraError =
                                            "Unable to read the QR code."

                                        scanCompleted.set(
                                            false,
                                        )
                                    }
                                    .addOnCompleteListener {
                                        imageProxy.close()
                                    }
                            }

                            cameraProvider.unbindAll()

                            cameraProvider.bindToLifecycle(
                                lifecycleOwner,
                                CameraSelector
                                    .DEFAULT_BACK_CAMERA,
                                preview,
                                imageAnalysis,
                            )
                        } catch (error: Exception) {
                            cameraError =
                                error.message
                                    ?: "Unable to start the camera."
                        }
                    },
                    ContextCompat.getMainExecutor(
                        viewContext,
                    ),
                )

                previewView
            },
        )

        if (cameraError != null) {
            Column(
                modifier =
                    Modifier
                        .align(Alignment.Center)
                        .padding(24.dp),
                horizontalAlignment =
                    Alignment.CenterHorizontally,
            ) {
                Text(
                    text =
                        cameraError
                            ?: "Unable to scan QR code.",
                    color =
                        MaterialTheme.colorScheme.error,
                )

                Button(
                    modifier =
                        Modifier.padding(top = 12.dp),
                    onClick = {
                        cameraError = null
                        scanCompleted.set(false)
                    },
                ) {
                    Text("Try again")
                }
            }
        } else {
            CircularProgressIndicator(
                modifier =
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 24.dp),
            )
        }
    }
}