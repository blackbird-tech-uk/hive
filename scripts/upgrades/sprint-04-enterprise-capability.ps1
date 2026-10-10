param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 04 - Enterprise Capability Foundation"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$ModelsPath = Join-Path $RepoRoot "apps\api\src\hive\modules\devices\models.py"
$DeviceSchemasPath = Join-Path $RepoRoot "apps\api\src\hive\modules\devices\schemas.py"
$AgentSchemasPath = Join-Path $RepoRoot "apps\api\src\hive\modules\device_agent\schemas.py"
$AgentServicePath = Join-Path $RepoRoot "apps\api\src\hive\modules\device_agent\service.py"
$AlembicVersionsDir = Join-Path $RepoRoot "apps\api\alembic\versions"

$AndroidModelsPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\Models.kt"
$DeviceInfoProviderPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\device\DeviceInfoProvider.kt"

$WebTypesPath = Join-Path $RepoRoot "apps\web\src\lib\api\types.ts"
$DashboardPath = Join-Path $RepoRoot "apps\web\src\pages\DeviceDashboard.tsx"
$StylesPath = Join-Path $RepoRoot "apps\web\src\styles\index.css"

$MigrationRevision = "d42ac83fe9b1"
$MigrationFile = Join-Path $AlembicVersionsDir "${MigrationRevision}_add_device_management_capabilities.py"

function Assert-File {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
}

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)][string]$Content,
        [Parameter(Mandatory = $true)][string]$Old,
        [Parameter(Mandatory = $true)][string]$New,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not $Content.Contains($Old)) {
        throw "Could not find expected block: $Label"
    }

    return $Content.Replace($Old, $New)
}

function Get-AlembicHead {
    $output = cmd.exe /c "docker compose exec -T api alembic heads 2>&1"

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to determine Alembic head: $($output -join ' ')"
    }

    $heads = @(
        $output | ForEach-Object {
            if ($_ -match '^([a-f0-9]+)\s+\(head\)$') {
                $Matches[1]
            }
        }
    )

    if ($heads.Count -ne 1) {
        throw "Expected one Alembic head but found: $($heads -join ', ')"
    }

    return $heads[0]
}

function Apply-Backend {
    Assert-File $ModelsPath
    Assert-File $DeviceSchemasPath
    Assert-File $AgentSchemasPath
    Assert-File $AgentServicePath

    $models = (Get-Content $ModelsPath -Raw).Replace("`r`n", "`n")

    if (-not $models.Contains("class DeviceManagementMode")) {
        $models = Replace-Exact `
            -Content $models `
            -Old @'
class DeviceCondition(str, enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
'@ `
            -New @'
class DeviceCondition(str, enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"


class DeviceManagementMode(str, enum.Enum):
    STANDARD = "standard"
    DEVICE_ADMIN = "device_admin"
    DEVICE_OWNER = "device_owner"
'@ `
            -Label "DeviceCondition enum"
    }

    if (-not $models.Contains("management_mode: Mapped[DeviceManagementMode]")) {
        $models = Replace-Exact `
            -Content $models `
            -Old @'
    agent_version: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    battery_level: Mapped[int | None] = mapped_column(
'@ `
            -New @'
    agent_version: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    management_mode: Mapped[DeviceManagementMode] = mapped_column(
        Enum(
            DeviceManagementMode,
            name="device_management_mode",
        ),
        nullable=False,
        default=DeviceManagementMode.STANDARD,
    )

    is_device_admin: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    is_device_owner: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    supports_lock_task: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    battery_level: Mapped[int | None] = mapped_column(
'@ `
            -Label "device capability model fields"
    }

    Set-Content $ModelsPath $models -Encoding UTF8

    $schemas = (Get-Content $DeviceSchemasPath -Raw).Replace("`r`n", "`n")

    if (-not $schemas.Contains("DeviceManagementMode")) {
        $schemas = $schemas.Replace(
            "from hive.modules.devices.models import DeviceCondition, DeviceStatus",
            "from hive.modules.devices.models import (`n    DeviceCondition,`n    DeviceManagementMode,`n    DeviceStatus,`n)"
        )
    }

    if (-not $schemas.Contains("management_mode: DeviceManagementMode")) {
        $schemas = Replace-Exact `
            -Content $schemas `
            -Old @'
    agent_version: str | None
    battery_level: int | None
'@ `
            -New @'
    agent_version: str | None
    management_mode: DeviceManagementMode
    is_device_admin: bool
    is_device_owner: bool
    supports_lock_task: bool
    battery_level: int | None
'@ `
            -Label "DeviceResponse capability fields"
    }

    Set-Content $DeviceSchemasPath $schemas -Encoding UTF8

    $agentSchemas = (Get-Content $AgentSchemasPath -Raw).Replace("`r`n", "`n")

    if (-not $agentSchemas.Contains("management_mode: str | None")) {
        $agentSchemas = Replace-Exact `
            -Content $agentSchemas `
            -Old @'
    build_version: str | None = Field(
        default=None,
        max_length=100,
    )


class DeviceCommandDelivery(BaseModel):
'@ `
            -New @'
    build_version: str | None = Field(
        default=None,
        max_length=100,
    )

    management_mode: str | None = Field(
        default=None,
        max_length=32,
    )

    is_device_admin: bool | None = None
    is_device_owner: bool | None = None
    supports_lock_task: bool | None = None


class DeviceCommandDelivery(BaseModel):
'@ `
            -Label "heartbeat capability schema fields"
    }

    if (-not $agentSchemas.Contains("management_mode: str | None = None")) {
        $agentSchemas = Replace-Exact `
            -Content $agentSchemas `
            -Old @'
    ip_address: str | None = None
    enrolled_at: datetime | None = None
'@ `
            -New @'
    ip_address: str | None = None
    management_mode: str | None = None
    is_device_admin: bool | None = None
    is_device_owner: bool | None = None
    supports_lock_task: bool | None = None
    enrolled_at: datetime | None = None
'@ `
            -Label "DeviceAgentResponse capability fields"
    }

    Set-Content $AgentSchemasPath $agentSchemas -Encoding UTF8

    $service = (Get-Content $AgentServicePath -Raw).Replace("`r`n", "`n")

    if (-not $service.Contains("payload.management_mode")) {
        $anchor = @'
        device.build_version = payload.build_version
'@

        $replacement = @'
        device.build_version = payload.build_version

        if payload.management_mode:
            device.management_mode = payload.management_mode

        if payload.is_device_admin is not None:
            device.is_device_admin = payload.is_device_admin

        if payload.is_device_owner is not None:
            device.is_device_owner = payload.is_device_owner

        if payload.supports_lock_task is not None:
            device.supports_lock_task = payload.supports_lock_task
'@

        $service = Replace-Exact `
            -Content $service `
            -Old $anchor `
            -New $replacement `
            -Label "heartbeat service capability persistence"
    }

    Set-Content $AgentServicePath $service -Encoding UTF8

    if (-not (Test-Path $MigrationFile)) {
        $downRevision = Get-AlembicHead

        @"
"""add device management capabilities

Revision ID: $MigrationRevision
Revises: $downRevision
Create Date: 2026-08-12
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "$MigrationRevision"
down_revision: Union[str, None] = "$downRevision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


device_management_mode = sa.Enum(
    "standard",
    "device_admin",
    "device_owner",
    name="device_management_mode",
)


def upgrade() -> None:
    device_management_mode.create(
        op.get_bind(),
        checkfirst=True,
    )

    op.add_column(
        "devices",
        sa.Column(
            "management_mode",
            device_management_mode,
            nullable=False,
            server_default="standard",
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "is_device_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "is_device_owner",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "supports_lock_task",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.alter_column(
        "devices",
        "management_mode",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "is_device_admin",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "is_device_owner",
        server_default=None,
    )
    op.alter_column(
        "devices",
        "supports_lock_task",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_column(
        "devices",
        "supports_lock_task",
    )
    op.drop_column(
        "devices",
        "is_device_owner",
    )
    op.drop_column(
        "devices",
        "is_device_admin",
    )
    op.drop_column(
        "devices",
        "management_mode",
    )

    device_management_mode.drop(
        op.get_bind(),
        checkfirst=True,
    )
"@ | Set-Content $MigrationFile -Encoding UTF8
    }
}

function Apply-Android {
    Assert-File $AndroidModelsPath
    Assert-File $DeviceInfoProviderPath

    $models = (Get-Content $AndroidModelsPath -Raw).Replace("`r`n", "`n")

    if (-not $models.Contains("val managementMode: String?")) {
        $models = Replace-Exact `
            -Content $models `
            -Old @'
    val buildVersion: String?,
    val imei: String?,
)
'@ `
            -New @'
    val buildVersion: String?,
    val imei: String?,
    val managementMode: String?,
    val isDeviceAdmin: Boolean?,
    val isDeviceOwner: Boolean?,
    val supportsLockTask: Boolean?,
)
'@ `
            -Label "Android heartbeat model capability fields"
    }

    Set-Content $AndroidModelsPath $models -Encoding UTF8

    $provider = (Get-Content $DeviceInfoProviderPath -Raw).Replace("`r`n", "`n")

    if (-not $provider.Contains("import android.app.admin.DevicePolicyManager")) {
        $provider = $provider.Replace(
            "import android.Manifest",
            "import android.Manifest`nimport android.app.admin.DevicePolicyManager"
        )
    }

    if (-not $provider.Contains("import android.content.ComponentName")) {
        $provider = $provider.Replace(
            "import android.content.Context",
            "import android.content.ComponentName`nimport android.content.Context"
        )
    }

    if (-not $provider.Contains("import com.blackbird.hiveagent.HiveDeviceAdminReceiver")) {
        $provider = $provider.Replace(
            "import com.blackbird.hiveagent.BuildConfig",
            "import com.blackbird.hiveagent.BuildConfig`nimport com.blackbird.hiveagent.HiveDeviceAdminReceiver"
        )
    }

    if (-not $provider.Contains("private val devicePolicyManager")) {
        $provider = Replace-Exact `
            -Content $provider `
            -Old @'
    private val applicationContext =
        context.applicationContext

    fun createHeartbeatRequest():
'@ `
            -New @'
    private val applicationContext =
        context.applicationContext

    private val devicePolicyManager =
        applicationContext.getSystemService(
            Context.DEVICE_POLICY_SERVICE,
        ) as DevicePolicyManager

    private val adminComponent =
        ComponentName(
            applicationContext,
            HiveDeviceAdminReceiver::class.java,
        )

    fun createHeartbeatRequest():
'@ `
            -Label "DevicePolicyManager fields"
    }

    if (-not $provider.Contains("isDeviceOwnerApp(")) {
        $provider = Replace-Exact `
            -Content $provider `
            -Old @'
        return DeviceHeartbeatRequest(
            batteryLevel =
                telemetry.batteryLevel,
'@ `
            -New @'
        val isDeviceOwner =
            devicePolicyManager.isDeviceOwnerApp(
                applicationContext.packageName,
            )

        val isDeviceAdmin =
            devicePolicyManager.isAdminActive(
                adminComponent,
            )

        val managementMode =
            when {
                isDeviceOwner -> "device_owner"
                isDeviceAdmin -> "device_admin"
                else -> "standard"
            }

        val supportsLockTask =
            isDeviceOwner

        return DeviceHeartbeatRequest(
            batteryLevel =
                telemetry.batteryLevel,
'@ `
            -Label "capability detection"
    }

    if (-not $provider.Contains("supportsLockTask =")) {
        $provider = Replace-Exact `
            -Content $provider `
            -Old @'
            buildVersion =
                Build.DISPLAY,
        )
'@ `
            -New @'
            buildVersion =
                Build.DISPLAY,
            managementMode =
                managementMode,
            isDeviceAdmin =
                isDeviceAdmin,
            isDeviceOwner =
                isDeviceOwner,
            supportsLockTask =
                supportsLockTask,
        )
'@ `
            -Label "heartbeat capability payload"
    }

    Set-Content $DeviceInfoProviderPath $provider -Encoding UTF8
}

function Apply-Web {
    Assert-File $WebTypesPath
    Assert-File $DashboardPath
    Assert-File $StylesPath

    $types = (Get-Content $WebTypesPath -Raw).Replace("`r`n", "`n")

    if (-not $types.Contains("management_mode:")) {
        $types = Replace-Exact `
            -Content $types `
            -Old @'
  agent_version: string | null

  battery_level: number | null
'@ `
            -New @'
  agent_version: string | null

  management_mode:
    | 'standard'
    | 'device_admin'
    | 'device_owner'
    | string
  is_device_admin: boolean
  is_device_owner: boolean
  supports_lock_task: boolean

  battery_level: number | null
'@ `
            -Label "web Device capability fields"
    }

    Set-Content $WebTypesPath $types -Encoding UTF8

    $dashboard = (Get-Content $DashboardPath -Raw).Replace("`r`n", "`n")

    if (-not $dashboard.Contains("function formatManagementMode")) {
        $anchor = @'
function formatRelativeTime(
'@

        $helper = @'
function formatManagementMode(
  mode: string | null | undefined,
): string {
  switch (mode) {
    case 'device_owner':
      return 'Device Owner'
    case 'device_admin':
      return 'Device Admin'
    default:
      return 'Standard'
  }
}

function formatRelativeTime(
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $anchor `
            -New $helper `
            -Label "formatRelativeTime helper anchor"
    }

    if (-not $dashboard.Contains("<span>Management mode</span>")) {
        $summaryAnchor = @'
        <article className="device-dashboard-summary-card">
          <span className="device-dashboard-summary-icon">
            <Wifi
'@

        $managementCard = @'
        <article className="device-dashboard-summary-card device-management-summary-card">
          <span className="device-dashboard-summary-icon">
            <Smartphone
              aria-hidden="true"
              size={21}
            />
          </span>

          <div>
            <span>Management mode</span>

            <strong>
              {formatManagementMode(
                device.management_mode,
              )}
            </strong>

            <small>
              {device.is_device_owner
                ? 'Enterprise Device Owner capabilities available'
                : device.is_device_admin
                  ? 'Device Admin active; enterprise controls limited'
                  : 'Standard app management; advanced controls unavailable'}
            </small>
          </div>
        </article>

        <article className="device-dashboard-summary-card">
          <span className="device-dashboard-summary-icon">
            <Wifi
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $summaryAnchor `
            -New $managementCard `
            -Label "dashboard management card insertion"
    }

    if (-not $dashboard.Contains("ENTERPRISE READINESS")) {
        $overviewAnchor = @'
      {activeTab === 'overview' && (
'@

        $dashboard = $dashboard.Replace(
            $overviewAnchor,
            $overviewAnchor
        )

        $overviewMarker = @'
        <div className="device-dashboard-overview-grid">
'@

        $enterprisePanel = @'
        <section className="device-enterprise-readiness">
          <div>
            <p className="eyebrow">
              ENTERPRISE READINESS
            </p>

            <h2>Management capabilities</h2>
          </div>

          <div className="device-capability-grid">
            <article>
              <span>Device Admin</span>
              <strong>
                {device.is_device_admin
                  ? 'Available'
                  : 'Not active'}
              </strong>
            </article>

            <article>
              <span>Device Owner</span>
              <strong>
                {device.is_device_owner
                  ? 'Available'
                  : 'Not provisioned'}
              </strong>
            </article>

            <article>
              <span>Lock task / kiosk</span>
              <strong>
                {device.supports_lock_task
                  ? 'Supported'
                  : 'Unavailable'}
              </strong>
            </article>
          </div>

          {!device.is_device_owner && (
            <p className="device-enterprise-note">
              Advanced enterprise actions stay disabled until a future
              test device is provisioned as Device Owner. This device
              remains fully usable in its current setup.
            </p>
          )}
        </section>

        <div className="device-dashboard-overview-grid">
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $overviewMarker `
            -New $enterprisePanel `
            -Label "overview enterprise readiness panel"
    }

    Set-Content $DashboardPath $dashboard -Encoding UTF8

    $styles = (Get-Content $StylesPath -Raw).Replace("`r`n", "`n")

    if (-not $styles.Contains("/* Sprint 04 - enterprise capability foundation */")) {
        $styles += @'

/* Sprint 04 - enterprise capability foundation */

.device-management-summary-card strong {
  text-transform: none;
}

.device-enterprise-readiness {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid #2d2d32;
  border-radius: 14px;
  background: #121214;
}

.device-capability-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.device-capability-grid article {
  padding: 13px;
  border: 1px solid #2a2a2f;
  border-radius: 10px;
  background: #18181b;
}

.device-capability-grid span {
  display: block;
  margin-bottom: 6px;
  color: #7f7f8a;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.device-capability-grid strong {
  color: #f4f4f5;
  font-size: 0.84rem;
}

.device-enterprise-note {
  margin: 14px 0 0;
  color: #8b8b95;
  font-size: 0.74rem;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .device-capability-grid {
    grid-template-columns: 1fr;
  }
}
'@
    }

    Set-Content $StylesPath $styles -Encoding UTF8
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
    Write-Host "  - Standard / Device Admin / Device Owner detection"
    Write-Host "  - Capability telemetry in heartbeat"
    Write-Host "  - Backend persistence and API exposure"
    Write-Host "  - Dashboard management-mode summary"
    Write-Host "  - Enterprise readiness panel"
    Write-Host "  - Lock-task capability reporting"
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
    docker compose exec -T api python -c "from hive.modules.devices.models import DeviceManagementMode; assert {x.value for x in DeviceManagementMode} == {'standard','device_admin','device_owner'}; print('Enterprise capability model OK')"
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

    foreach ($path in @(
        $MigrationFile,
        $ModelsPath,
        $AgentSchemasPath,
        $AndroidModelsPath,
        $DeviceInfoProviderPath,
        $WebTypesPath,
        $DashboardPath
    )) {
        Assert-File $path
    }

    $provider = Get-Content $DeviceInfoProviderPath -Raw
    $dashboard = Get-Content $DashboardPath -Raw
    $models = Get-Content $ModelsPath -Raw

    foreach ($marker in @(
        "isDeviceOwnerApp",
        "isAdminActive",
        "supportsLockTask"
    )) {
        if (-not $provider.Contains($marker)) {
            throw "Android capability detection missing: $marker"
        }
    }

    foreach ($marker in @(
        "DeviceManagementMode",
        "management_mode",
        "is_device_owner",
        "is_device_admin",
        "supports_lock_task"
    )) {
        if (-not $models.Contains($marker)) {
            throw "Backend capability marker missing: $marker"
        }
    }

    foreach ($marker in @(
        "Management mode",
        "ENTERPRISE READINESS",
        "device.supports_lock_task"
    )) {
        if (-not $dashboard.Contains($marker)) {
            throw "Dashboard capability marker missing: $marker"
        }
    }

    Write-Host ""
    Write-Host "Sprint 04 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual test:"
    Write-Host "  1. Install the new APK on the existing Unitech."
    Write-Host "  2. Open Hive Agent once."
    Write-Host "  3. Wait for a heartbeat."
    Write-Host "  4. Rebuild web if needed and open the device Overview."
    Write-Host "  5. Current device should report Standard unless Device Admin is active."
    Write-Host "  6. Device Owner should remain Not provisioned."
}

function Collect-Sprint {
    Write-Host "Sprint 04 context has already been collected." -ForegroundColor Yellow
}

switch ($Mode) {
    "Collect" { Collect-Sprint }
    "Apply" { Apply-Sprint }
    "Validate" { Validate-Sprint }
}


