param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 05 - Policy & Kiosk Readiness"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$AndroidModels = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\Models.kt"
$AndroidClient = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\HiveApiClient.kt"
$DeviceInfo = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\device\DeviceInfoProvider.kt"
$CommandProcessor = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt"

$DeviceModels = Join-Path $RepoRoot "apps\api\src\hive\modules\devices\models.py"
$DeviceSchemas = Join-Path $RepoRoot "apps\api\src\hive\modules\devices\schemas.py"
$AgentSchemas = Join-Path $RepoRoot "apps\api\src\hive\modules\device_agent\schemas.py"
$AgentService = Join-Path $RepoRoot "apps\api\src\hive\modules\device_agent\service.py"
$AlembicDir = Join-Path $RepoRoot "apps\api\alembic\versions"

$WebTypes = Join-Path $RepoRoot "apps\web\src\lib\api\types.ts"
$Dashboard = Join-Path $RepoRoot "apps\web\src\pages\DeviceDashboard.tsx"
$Styles = Join-Path $RepoRoot "apps\web\src\styles\index.css"

$Revision = "e53b91c4d7a2"
$DownRevision = "d42ac83fe9b1"
$Migration = Join-Path $AlembicDir "${Revision}_add_policy_readiness_state.py"

function Require-File {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Required file missing: $Path"
    }
}

function Write-Utf8 {
    param([string]$Path, [string]$Content)
    Set-Content -Path $Path -Value $Content -Encoding UTF8
}

function Regex-ReplaceOnce {
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
        throw "Sprint 05 could not find insertion point: $Label"
    }

    return $regex.Replace($Content, $Replacement, 1)
}

function Apply-Backend {
    Require-File $DeviceModels
    Require-File $DeviceSchemas
    Require-File $AgentSchemas
    Require-File $AgentService

    $content = Get-Content $DeviceModels -Raw

    if ($content -notmatch 'supports_device_lock:\s*Mapped\[bool\]') {
        $insert = @'
    supports_device_lock: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_lock_task_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

'@
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^    battery_level: Mapped\[int \| None\] = mapped_column\(' `
            -Replacement ($insert + '    battery_level: Mapped[int | None] = mapped_column(') `
            -Label "device model battery_level"
        Write-Utf8 $DeviceModels $content
    }

    $content = Get-Content $DeviceSchemas -Raw
    if ($content -notmatch 'supports_device_lock:\s*bool') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^    battery_level: int \| None$' `
            -Replacement @'
    supports_device_lock: bool
    is_lock_task_active: bool
    battery_level: int | None
'@ `
            -Label "DeviceResponse battery_level"
        Write-Utf8 $DeviceSchemas $content
    }

    $content = Get-Content $AgentSchemas -Raw
    if ($content -notmatch 'supports_device_lock: bool \| None') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^    supports_lock_task: bool \| None = None$' `
            -Replacement @'
    supports_lock_task: bool | None = None
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None
'@ `
            -Label "agent response supports_lock_task"

        $matches = [regex]::Matches(
            $content,
            '(?m)^    supports_lock_task: bool \| None = None$'
        )

        if ($matches.Count -gt 0) {
            $content = [regex]::Replace(
                $content,
                '(?m)^    supports_lock_task: bool \| None = None$',
@'
    supports_lock_task: bool | None = None
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None
'@,
                1
            )
        }

        Write-Utf8 $AgentSchemas $content
    }

    $content = Get-Content $AgentService -Raw
    if ($content -notmatch 'payload\.supports_device_lock') {
        $insert = @'

        if payload.supports_device_lock is not None:
            device.supports_device_lock = payload.supports_device_lock

        if payload.is_lock_task_active is not None:
            device.is_lock_task_active = payload.is_lock_task_active
'@
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?ms)(        if payload\.supports_lock_task is not None:\r?\n            device\.supports_lock_task = payload\.supports_lock_task)' `
            -Replacement ('$1' + $insert) `
            -Label "heartbeat supports_lock_task persistence"
        Write-Utf8 $AgentService $content
    }

    if (-not (Test-Path $Migration)) {
@"
"""add policy readiness state

Revision ID: $Revision
Revises: $DownRevision
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "$Revision"
down_revision: Union[str, None] = "$DownRevision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column(
            "supports_device_lock",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "is_lock_task_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column(
        "devices",
        "supports_device_lock",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "is_lock_task_active",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column("devices", "is_lock_task_active")
    op.drop_column("devices", "supports_device_lock")
"@ | Set-Content $Migration -Encoding UTF8
    }
}

function Apply-Android {
    Require-File $AndroidModels
    Require-File $AndroidClient
    Require-File $DeviceInfo
    Require-File $CommandProcessor

    $content = Get-Content $AndroidModels -Raw
    if ($content -notmatch 'val supportsDeviceLock: Boolean\?') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^    val supportsLockTask: Boolean\?,$' `
            -Replacement @'
    val supportsLockTask: Boolean?,
    val supportsDeviceLock: Boolean?,
    val isLockTaskActive: Boolean?,
'@ `
            -Label "Android heartbeat supportsLockTask"
        Write-Utf8 $AndroidModels $content
    }

    $content = Get-Content $AndroidClient -Raw
    if ($content -notmatch '"supports_device_lock"') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^            putNullable\("supports_lock_task", payload\.supportsLockTask\)$' `
            -Replacement @'
            putNullable("supports_lock_task", payload.supportsLockTask)
            putNullable("supports_device_lock", payload.supportsDeviceLock)
            putNullable("is_lock_task_active", payload.isLockTaskActive)
'@ `
            -Label "heartbeat JSON supports_lock_task"
        Write-Utf8 $AndroidClient $content
    }

    $content = Get-Content $DeviceInfo -Raw

    if ($content -notmatch 'import android\.app\.ActivityManager') {
        $content = $content.Replace(
            'import android.Manifest',
            "import android.Manifest`r`nimport android.app.ActivityManager"
        )
    }

    if ($content -notmatch 'val supportsDeviceLock') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?ms)(        val supportsLockTask =\r?\n            isDeviceOwner)' `
            -Replacement @'
$1

        val supportsDeviceLock =
            isDeviceOwner || isDeviceAdmin

        val activityManager =
            applicationContext.getSystemService(
                Context.ACTIVITY_SERVICE,
            ) as ActivityManager

        val isLockTaskActive =
            activityManager.lockTaskModeState !=
                ActivityManager.LOCK_TASK_MODE_NONE
'@ `
            -Label "Android management capability calculation"
    }

    if ($content -notmatch 'supportsDeviceLock =\s*\r?\n\s*supportsDeviceLock') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?ms)(            supportsLockTask =\r?\n                supportsLockTask,)' `
            -Replacement @'
$1
            supportsDeviceLock =
                supportsDeviceLock,
            isLockTaskActive =
                isLockTaskActive,
'@ `
            -Label "Android heartbeat capability arguments"
    }

    Write-Utf8 $DeviceInfo $content

    $content = Get-Content $CommandProcessor -Raw

    if ($content -notmatch 'import android\.app\.admin\.DevicePolicyManager') {
        $content = $content.Replace(
            'import android.Manifest',
            "import android.Manifest`r`nimport android.app.admin.DevicePolicyManager"
        )
    }

    if ($content -notmatch 'import android\.content\.ComponentName') {
        $content = $content.Replace(
            'import android.content.Context',
            "import android.content.ComponentName`r`nimport android.content.Context"
        )
    }

    if ($content -notmatch 'import com\.blackbird\.hiveagent\.HiveDeviceAdminReceiver') {
        $content = $content.Replace(
            'import com.blackbird.hiveagent.api.CommandExecutionResult',
            "import com.blackbird.hiveagent.HiveDeviceAdminReceiver`r`nimport com.blackbird.hiveagent.api.CommandExecutionResult"
        )
    }

    if ($content -notmatch 'private val devicePolicyManager') {
        $anchor = @'
    private val locationManager =
        context.getSystemService(
            Context.LOCATION_SERVICE,
        ) as LocationManager
'@
        $replacement = @'
    private val locationManager =
        context.getSystemService(
            Context.LOCATION_SERVICE,
        ) as LocationManager

    private val devicePolicyManager =
        context.getSystemService(
            Context.DEVICE_POLICY_SERVICE,
        ) as DevicePolicyManager

    private val adminComponent =
        ComponentName(
            context,
            HiveDeviceAdminReceiver::class.java,
        )
'@
        if (-not $content.Contains($anchor)) {
            throw "Sprint 05 could not find CommandProcessor locationManager block."
        }
        $content = $content.Replace($anchor, $replacement)
    }

    if ($content -notmatch '"LOCK_DEVICE" -> executeLockDevice\(\)') {
        $content = [regex]::Replace(
            $content,
            '(?ms)            "LOCK_DEVICE" -> failure\(\r?\n                "LOCK_DEVICE requires Android device-owner " \+\r?\n                    "or device-admin provisioning\.",\r?\n            \)',
            '            "LOCK_DEVICE" -> executeLockDevice()',
            1
        )
    }

    if ($content -notmatch 'private fun executeLockDevice\(') {
        $method = @'

    private fun executeLockDevice(): CommandExecutionResult {
        val isDeviceOwner =
            devicePolicyManager.isDeviceOwnerApp(
                context.packageName,
            )

        val isDeviceAdmin =
            devicePolicyManager.isAdminActive(
                adminComponent,
            )

        if (!isDeviceOwner && !isDeviceAdmin) {
            return failure(
                "LOCK_DEVICE requires active Device Admin or Device Owner capability.",
            )
        }

        return try {
            devicePolicyManager.lockNow()

            success(
                "Device lock requested successfully.",
            )
        } catch (exception: SecurityException) {
            failure(
                exception.message
                    ?: "Android rejected the device lock request.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to lock the device.",
            )
        }
    }
'@
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^    private suspend fun executeRequestLocation\(' `
            -Replacement ($method + "`r`n    private suspend fun executeRequestLocation(") `
            -Label "executeRequestLocation method"
    }

    Write-Utf8 $CommandProcessor $content
}

function Apply-Web {
    Require-File $WebTypes
    Require-File $Dashboard
    Require-File $Styles

    $content = Get-Content $WebTypes -Raw
    if ($content -notmatch 'supports_device_lock:\s*boolean') {
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^  supports_lock_task: boolean$' `
            -Replacement @'
  supports_lock_task: boolean
  supports_device_lock: boolean
  is_lock_task_active: boolean
'@ `
            -Label "web Device supports_lock_task"
        Write-Utf8 $WebTypes $content
    }

    $content = Get-Content $Dashboard -Raw

    if ($content -notmatch "sendCommand\('LOCK_DEVICE'\)") {
        $lockButton = @'

          <button
            className="device-dashboard-action"
            disabled={
              sendingCommand !== null ||
              !device.supports_device_lock
            }
            onClick={() =>
              void sendCommand('LOCK_DEVICE')
            }
            title={
              device.supports_device_lock
                ? 'Lock this managed device'
                : 'Requires active Device Admin or Device Owner'
            }
            type="button"
          >
            <Smartphone
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'LOCK_DEVICE'
                  ? 'Queuing...'
                  : 'Lock device'}
              </strong>

              <small>
                {device.supports_device_lock
                  ? 'Immediately lock the screen'
                  : 'Requires Device Admin'}
              </small>
            </span>
          </button>
'@
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^          <button\r?\n            className="device-dashboard-action"\r?\n            disabled=\{loading\}' `
            -Replacement ($lockButton + "`r`n          <button`r`n            className=`"device-dashboard-action`"`r`n            disabled={loading}") `
            -Label "Refresh telemetry quick action"
    }

    if ($content -notmatch '<span>Device lock</span>') {
        $policyCards = @'

              <article>
                <span>Device lock</span>
                <strong>
                  {device.supports_device_lock
                    ? 'Ready'
                    : 'Unavailable'}
                </strong>
              </article>

              <article>
                <span>Kiosk state</span>
                <strong>
                  {device.is_lock_task_active
                    ? 'Active'
                    : 'Inactive'}
                </strong>
              </article>
'@
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?ms)(              <article>\r?\n                <span>Lock task / kiosk</span>.*?              </article>)' `
            -Replacement ('$1' + $policyCards) `
            -Label "enterprise lock task card"
    }

    if ($content -notmatch 'POLICY STATUS') {
        $panel = @'

          <section className="device-policy-status">
            <div>
              <p className="eyebrow">
                POLICY STATUS
              </p>
              <h2>Control readiness</h2>
            </div>

            <div className="device-policy-status-grid">
              <div>
                <span>Remote lock</span>
                <strong>
                  {device.supports_device_lock
                    ? 'Available'
                    : 'Blocked'}
                </strong>
                <small>
                  {device.supports_device_lock
                    ? 'Hive can request an immediate device lock.'
                    : 'Enable Device Admin or provision Device Owner.'}
                </small>
              </div>

              <div>
                <span>Kiosk / lock task</span>
                <strong>
                  {device.supports_lock_task
                    ? 'Ready'
                    : 'Requires Device Owner'}
                </strong>
                <small>
                  {device.is_lock_task_active
                    ? 'Lock task mode is currently active.'
                    : 'Lock task mode is currently inactive.'}
                </small>
              </div>
            </div>
          </section>
'@
        $content = Regex-ReplaceOnce `
            -Content $content `
            -Pattern '(?m)^          <section className="device-dashboard-panel">$' `
            -Replacement ($panel + "`r`n          <section className=`"device-dashboard-panel`">") `
            -Label "first overview dashboard panel"
    }

    Write-Utf8 $Dashboard $content

    $content = Get-Content $Styles -Raw
    if ($content -notmatch 'Sprint 05 - policy and kiosk readiness') {
        $content += @'

/* Sprint 05 - policy and kiosk readiness */

.device-policy-status {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid #2d2d32;
  border-radius: 14px;
  background: #121214;
}

.device-policy-status h2 {
  margin: 5px 0 0;
}

.device-policy-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.device-policy-status-grid > div {
  padding: 14px;
  border: 1px solid #2a2a2f;
  border-radius: 10px;
  background: #18181b;
}

.device-policy-status-grid span,
.device-policy-status-grid small {
  display: block;
}

.device-policy-status-grid span {
  color: #7f7f8a;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.device-policy-status-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 0.86rem;
}

.device-policy-status-grid small {
  margin-top: 5px;
  color: #8b8b95;
  line-height: 1.5;
}

.device-dashboard-action:disabled {
  cursor: not-allowed;
}

@media (max-width: 760px) {
  .device-policy-status-grid {
    grid-template-columns: 1fr;
  }
}
'@
        Write-Utf8 $Styles $content
    }
}

function Apply-Sprint {
    Write-Host ""
    Write-Host "Applying $SprintName" -ForegroundColor Yellow

    Apply-Backend
    Apply-Android
    Apply-Web

    Write-Host ""
    Write-Host "$SprintName applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "Added:"
    Write-Host "  - Device-lock capability telemetry"
    Write-Host "  - Lock-task active-state telemetry"
    Write-Host "  - Safe Device Admin / Device Owner LOCK_DEVICE execution"
    Write-Host "  - Capability-aware Lock Device dashboard action"
    Write-Host "  - Policy readiness dashboard status"
    Write-Host "  - Kiosk readiness state without enabling kiosk mode"
    Write-Host ""
    Write-Host "No factory reset or Device Owner provisioning was performed."
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Yellow

    Write-Host "`n[1/7] Git diff" -ForegroundColor Cyan
    git diff --stat

    Write-Host "`n[2/7] Rebuild API container" -ForegroundColor Cyan
    docker compose up -d --build api
    if ($LASTEXITCODE -ne 0) {
        throw "API container build failed."
    }

    Write-Host "`n[3/7] Alembic upgrade" -ForegroundColor Cyan
    cmd.exe /c "docker compose exec -T api alembic upgrade head"
    if ($LASTEXITCODE -ne 0) {
        throw "Alembic upgrade failed."
    }

    Write-Host "`n[4/7] API smoke test" -ForegroundColor Cyan
    docker compose exec -T api python -c "from hive.modules.devices.schemas import DeviceResponse; DeviceResponse.model_rebuild(); from hive.modules.devices.models import Device; assert hasattr(Device, 'supports_device_lock'); assert hasattr(Device, 'is_lock_task_active'); print('Sprint 05 API OK')"
    if ($LASTEXITCODE -ne 0) {
        throw "API smoke test failed."
    }

    Write-Host "`n[5/7] Web production build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\web")
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "Web build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "`n[6/7] Android debug build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\android-agent")
    try {
        .\gradlew.bat :app:assembleDebug
        if ($LASTEXITCODE -ne 0) {
            throw "Android build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "`n[7/7] Sprint assertions" -ForegroundColor Cyan

    $checks = @(
        @{ Path = $CommandProcessor; Marker = "executeLockDevice" },
        @{ Path = $CommandProcessor; Marker = "devicePolicyManager.lockNow()" },
        @{ Path = $DeviceInfo; Marker = "supportsDeviceLock" },
        @{ Path = $DeviceInfo; Marker = "isLockTaskActive" },
        @{ Path = $DeviceModels; Marker = "supports_device_lock" },
        @{ Path = $DeviceModels; Marker = "is_lock_task_active" },
        @{ Path = $Dashboard; Marker = "POLICY STATUS" },
        @{ Path = $Dashboard; Marker = "Lock device" },
        @{ Path = $Dashboard; Marker = "device.supports_device_lock" },
        @{ Path = $WebTypes; Marker = "is_lock_task_active" }
    )

    foreach ($check in $checks) {
        Require-File $check.Path
        $text = Get-Content $check.Path -Raw
        if (-not $text.Contains($check.Marker)) {
            throw "Sprint 05 assertion missing: $($check.Marker)"
        }
    }

    Write-Host ""
    Write-Host "Sprint 05 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual test:"
    Write-Host "  1. Install the new APK with adb install -r (do not uninstall Hive Agent)."
    Write-Host "  2. Open Hive Agent once and wait for a heartbeat."
    Write-Host "  3. Rebuild web if needed and open LB164."
    Write-Host "  4. Standard device: Lock Device must remain disabled."
    Write-Host "  5. Policy Status should show Remote lock Blocked."
    Write-Host "  6. Kiosk should show Requires Device Owner / Inactive."
    Write-Host "  7. Do not enable Device Owner or factory reset the current device."
}

function Collect-Sprint {
    Write-Host "Sprint 05 context has already been collected." -ForegroundColor Yellow
}

switch ($Mode) {
    "Collect" { Collect-Sprint }
    "Apply" { Apply-Sprint }
    "Validate" { Validate-Sprint }
}
