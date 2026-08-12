param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$MainActivity = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\MainActivity.kt"
$AdminXml = Join-Path $RepoRoot "apps\android-agent\app\src\main\res\xml\device_admin_receiver.xml"

function Replace-Once {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Label
    )

    $regex = [regex]::new(
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )

    if (-not $regex.IsMatch($Content)) {
        throw "Sprint 06 could not find $Label."
    }

    return $regex.Replace($Content, $Replacement, 1)
}

function Apply-Sprint {
    Write-Host ""
    Write-Host "Applying Sprint 06 - Device Admin & Policy Management" -ForegroundColor Cyan

    $content = Get-Content $MainActivity -Raw

    if ($content -notmatch 'import android\.app\.admin\.DevicePolicyManager') {
        $content = Replace-Once `
            $content `
            '(?m)^import android\.Manifest\r?$' `
            "import android.Manifest`r`nimport android.app.admin.DevicePolicyManager`r`nimport android.content.ComponentName" `
            "MainActivity import block"
    }

    if ($content -notmatch 'val adminComponent = ComponentName\(') {
        $contextBlock = @'
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
'@

        $content = Replace-Once `
            $content `
            '(?m)^    val context = LocalContext\.current\r?$' `
            $contextBlock `
            "MainActivity context block"
    }

    if ($content -notmatch 'onActivateDeviceAdmin\s*=') {
        $callReplacement = @'
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
                },
'@

        $content = Replace-Once `
            $content `
            '(?ms)                onClearEnrolment\s*=\s*\r?\n\s*hiveViewModel::clearEnrolment,\r?\n' `
            $callReplacement `
            "EnrolledDeviceScreen callback block"
    }

    if ($content -notmatch 'isDeviceAdminActive: Boolean') {
        $signatureReplacement = @'
    onRefresh: () -> Unit,
    onClearEnrolment: () -> Unit,
    isDeviceAdminActive: Boolean,
    onActivateDeviceAdmin: () -> Unit,
) {
'@

        $content = Replace-Once `
            $content `
            '(?ms)    onRefresh:\s*\(\) -> Unit,\r?\n\s*onClearEnrolment:\s*\(\) -> Unit,\r?\n\) \{' `
            $signatureReplacement `
            "EnrolledDeviceScreen signature"
    }

    if ($content -notmatch 'Text\("Activate Device Admin"\)') {
        $adminUi = @'
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
'@

        $content = Replace-Once `
            $content `
            '(?ms)        Button\(\r?\n\s*onClick = onRefresh,\r?\n\s*modifier\s*=\s*\r?\n\s*Modifier\.fillMaxWidth\(\),\r?\n\s*\) \{\r?\n\s*Text\("Refresh"\)\r?\n\s*\}' `
            $adminUi `
            "Refresh button block"
    }

    Set-Content $MainActivity $content -Encoding UTF8

    @'
<?xml version="1.0" encoding="utf-8"?>
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <force-lock />
        <disable-camera />
    </uses-policies>
</device-admin>
'@ | Set-Content $AdminXml -Encoding UTF8

    Write-Host ""
    Write-Host "Sprint 06 applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "Added:"
    Write-Host "- In-app Device Admin activation workflow"
    Write-Host "- Immediate capability refresh after Android returns from activation"
    Write-Host "- Device Admin status inside Hive Agent"
    Write-Host "- Existing LOCK_DEVICE becomes available when Device Admin is active"
    Write-Host "- Device Admin declaration limited to force-lock + camera policy"
    Write-Host "- No Device Owner provisioning, password reset or wipe"
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating Sprint 06 - Device Admin & Policy Management" -ForegroundColor Cyan

    $content = Get-Content $MainActivity -Raw
    $adminXml = Get-Content $AdminXml -Raw

    $checks = @(
        @{ Name = "Device Admin launcher"; Pass = $content.Contains("DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN") },
        @{ Name = "Admin component"; Pass = $content.Contains("HiveDeviceAdminReceiver::class.java") },
        @{ Name = "Activation button"; Pass = $content.Contains("Activate Device Admin") },
        @{ Name = "Admin status"; Pass = $content.Contains("Device Admin active") },
        @{ Name = "Force-lock policy"; Pass = $adminXml.Contains("<force-lock />") },
        @{ Name = "No wipe-data policy"; Pass = -not $adminXml.Contains("<wipe-data />") },
        @{ Name = "No reset-password policy"; Pass = -not $adminXml.Contains("<reset-password />") }
    )

    foreach ($check in $checks) {
        if (-not $check.Pass) {
            throw "Sprint 06 validation failed: $($check.Name)"
        }

        Write-Host "[PASS] $($check.Name)" -ForegroundColor Green
    }

    Write-Host ""
    Write-Host "[1/3] API compile" -ForegroundColor Cyan
    docker compose exec -T api python -m compileall /app/src/hive
    if ($LASTEXITCODE -ne 0) { throw "API compile failed." }

    Write-Host ""
    Write-Host "[2/3] Web production build" -ForegroundColor Cyan
    docker compose exec -T web npm run build
    if ($LASTEXITCODE -ne 0) { throw "Web production build failed." }

    Write-Host ""
    Write-Host "[3/3] Android debug build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\android-agent")
    try {
        .\gradlew.bat assembleDebug
        if ($LASTEXITCODE -ne 0) { throw "Android debug build failed." }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "Sprint 06 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual test:"
    Write-Host "1. Install APK with adb install -r."
    Write-Host "2. Open Hive Agent."
    Write-Host "3. Tap Activate Device Admin."
    Write-Host "4. Approve Android's Device Admin screen."
    Write-Host "5. Refresh telemetry / wait for heartbeat."
    Write-Host "6. Dashboard should show Device Admin Available + Device lock Ready."
    Write-Host "7. Send Lock device and confirm LB164 locks."
}

function Collect-Sprint {
    Write-Host "Sprint 06 context has already been collected." -ForegroundColor Yellow
}

switch ($Mode) {
    "Collect" { Collect-Sprint }
    "Apply" { Apply-Sprint }
    "Validate" { Validate-Sprint }
}