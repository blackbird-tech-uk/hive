param(
    [ValidateSet("Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 02 - Installed Apps Inventory"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$InventoryDir = Join-Path $RepoRoot "apps\api\src\hive\modules\inventory"
$ApiRouterPath = Join-Path $RepoRoot "apps\api\src\hive\api\v1\router.py"
$AlembicVersionsDir = Join-Path $RepoRoot "apps\api\alembic\versions"

$ModelsKtPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\Models.kt"
$HiveApiClientPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\HiveApiClient.kt"
$CommandProcessorPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt"

$WebApiDir = Join-Path $RepoRoot "apps\web\src\lib\api"
$WebTypesPath = Join-Path $WebApiDir "types.ts"
$WebIndexPath = Join-Path $WebApiDir "index.ts"
$DeviceDashboardPath = Join-Path $RepoRoot "apps\web\src\pages\DeviceDashboard.tsx"
$StylesPath = Join-Path $RepoRoot "apps\web\src\styles\index.css"

function Assert-File {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Required file not found: $Path"
    }
}

function Replace-Exact {
    param(
        [string]$Content,
        [string]$Old,
        [string]$New,
        [string]$Label
    )

    if (-not $Content.Contains($Old)) {
        throw "Could not find expected block: $Label"
    }

    return $Content.Replace($Old, $New)
}

function Get-LatestAlembicRevision {
    $headOutput =
        docker compose exec -T api alembic heads 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw "Unable to determine Alembic head: $headOutput"
    }

    $heads = @(
        $headOutput |
            ForEach-Object {
                if (
                    $_ -match '^([a-f0-9]+)\s+\(head\)$'
                ) {
                    $Matches[1]
                }
            }
    )

    if ($heads.Count -ne 1) {
        throw "Expected exactly one Alembic head but found: $($heads -join ', ')"
    }

    return $heads[0]
}

function Apply-Backend {
    New-Item -ItemType Directory -Path $InventoryDir -Force | Out-Null

    @'
from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from hive.modules.inventory.models import InstalledApplication


class InstalledApplicationRepository:
    """Persistence for installed application inventory."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_for_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
    ) -> list[InstalledApplication]:
        statement = (
            select(InstalledApplication)
            .where(
                InstalledApplication.organization_id
                == organization_id,
                InstalledApplication.device_id == device_id,
            )
            .order_by(
                InstalledApplication.is_system_app.asc(),
                InstalledApplication.app_name.asc().nullslast(),
                InstalledApplication.package_name.asc(),
            )
        )

        return list(
            self.db.scalars(statement).all()
        )

    def delete_for_device(
        self,
        *,
        organization_id: uuid.UUID,
        device_id: uuid.UUID,
    ) -> None:
        self.db.execute(
            delete(InstalledApplication).where(
                InstalledApplication.organization_id
                == organization_id,
                InstalledApplication.device_id == device_id,
            )
        )

    def add(
        self,
        application: InstalledApplication,
    ) -> InstalledApplication:
        self.db.add(application)
        return application
'@ | Set-Content `
        -Path (Join-Path $InventoryDir "repository.py") `
        -Encoding UTF8

    @'
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from hive.modules.devices.models import Device
from hive.modules.inventory.models import InstalledApplication
from hive.modules.inventory.repository import InstalledApplicationRepository
from hive.modules.inventory.schemas import (
    InstalledApplicationInventoryResponse,
    InstalledApplicationInventoryUpload,
    InstalledApplicationResponse,
)


class InstalledApplicationService:
    """Business logic for application inventory."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repository = InstalledApplicationRepository(db)

    def replace_inventory(
        self,
        *,
        device: Device,
        payload: InstalledApplicationInventoryUpload,
    ) -> InstalledApplicationInventoryResponse:
        reported_at = datetime.now(UTC)

        try:
            self.repository.delete_for_device(
                organization_id=device.organization_id,
                device_id=device.id,
            )

            for item in payload.applications:
                self.repository.add(
                    InstalledApplication(
                        organization_id=device.organization_id,
                        device_id=device.id,
                        package_name=item.package_name,
                        app_name=item.app_name,
                        version_name=item.version_name,
                        version_code=item.version_code,
                        is_system_app=item.is_system_app,
                        is_enabled=item.is_enabled,
                        first_installed_at=item.first_installed_at,
                        last_updated_at=item.last_updated_at,
                        reported_at=reported_at,
                    )
                )

            self.db.commit()

        except Exception:
            self.db.rollback()
            raise

        return InstalledApplicationInventoryResponse(
            device_id=device.id,
            application_count=len(payload.applications),
            reported_at=reported_at,
        )

    def list_inventory(
        self,
        *,
        organization_id,
        device_id,
    ) -> list[InstalledApplicationResponse]:
        applications = self.repository.list_for_device(
            organization_id=organization_id,
            device_id=device_id,
        )

        return [
            InstalledApplicationResponse.model_validate(
                application
            )
            for application in applications
        ]
'@ | Set-Content `
        -Path (Join-Path $InventoryDir "service.py") `
        -Encoding UTF8

    @'
from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from hive.db.session import get_db
from hive.modules.auth.dependencies import CurrentUser
from hive.modules.device_agent.dependencies import CurrentDevice
from hive.modules.devices.service import (
    DeviceNotFoundError,
    DevicePermissionDeniedError,
    DeviceService,
)
from hive.modules.inventory.schemas import (
    InstalledApplicationInventoryResponse,
    InstalledApplicationInventoryUpload,
    InstalledApplicationResponse,
)
from hive.modules.inventory.service import InstalledApplicationService

router = APIRouter(
    tags=["Installed Applications"],
)

DatabaseSession = Annotated[
    Session,
    Depends(get_db),
]


@router.post(
    "/device-agent/apps",
    response_model=InstalledApplicationInventoryResponse,
    status_code=status.HTTP_200_OK,
)
def upload_installed_applications(
    payload: InstalledApplicationInventoryUpload,
    db: DatabaseSession,
    current_device: CurrentDevice,
) -> InstalledApplicationInventoryResponse:
    """Replace inventory for the authenticated device."""

    return InstalledApplicationService(
        db
    ).replace_inventory(
        device=current_device,
        payload=payload,
    )


@router.get(
    "/organizations/{organization_id}/devices/{device_id}/apps",
    response_model=list[InstalledApplicationResponse],
)
def list_installed_applications(
    organization_id: UUID,
    device_id: UUID,
    db: DatabaseSession,
    current_user: CurrentUser,
) -> list[InstalledApplicationResponse]:
    """Return installed applications for one managed device."""

    device_service = DeviceService(db)

    try:
        device_service.get_device(
            organization_id=organization_id,
            device_id=device_id,
            actor=current_user,
        )
    except DevicePermissionDeniedError as exc:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    except DeviceNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return InstalledApplicationService(
        db
    ).list_inventory(
        organization_id=organization_id,
        device_id=device_id,
    )
'@ | Set-Content `
        -Path (Join-Path $InventoryDir "router.py") `
        -Encoding UTF8

    $apiRouter = (
        Get-Content $ApiRouterPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $apiRouter.Contains(
            "from hive.modules.inventory.router import router as inventory_router"
        )
    ) {
        $apiRouter = $apiRouter.Replace(
            "from hive.modules.events.router import router as events_router",
            "from hive.modules.events.router import router as events_router`nfrom hive.modules.inventory.router import router as inventory_router"
        )
    }

    if (
        -not $apiRouter.Contains(
            "api_router.include_router(inventory_router)"
        )
    ) {
        $apiRouter = $apiRouter.Replace(
            "api_router.include_router(device_commands_router)",
            "api_router.include_router(device_commands_router)`napi_router.include_router(inventory_router)"
        )
    }

    Set-Content `
        -Path $ApiRouterPath `
        -Value $apiRouter `
        -Encoding UTF8

    $latestRevision = Get-LatestAlembicRevision
    $migrationPath = Join-Path `
        $AlembicVersionsDir `
        "a81c2d7b9f10_add_installed_applications.py"

    if (-not (Test-Path $migrationPath)) {
        @"
"""add installed applications

Revision ID: a81c2d7b9f10
Revises: $latestRevision
Create Date: 2026-08-12
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "a81c2d7b9f10"
down_revision: Union[str, None] = "$latestRevision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "installed_applications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column(
            "device_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("package_name", sa.String(length=255), nullable=False),
        sa.Column("app_name", sa.String(length=255), nullable=True),
        sa.Column("version_name", sa.String(length=100), nullable=True),
        sa.Column("version_code", sa.BigInteger(), nullable=True),
        sa.Column(
            "is_system_app",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column(
            "is_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
        sa.Column(
            "first_installed_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "last_updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "reported_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(
            ["device_id"],
            ["devices.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "device_id",
            "package_name",
            name="uq_installed_applications_device_package",
        ),
    )

    op.create_index(
        op.f("ix_installed_applications_device_id"),
        "installed_applications",
        ["device_id"],
        unique=False,
    )

    op.create_index(
        op.f("ix_installed_applications_organization_id"),
        "installed_applications",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_installed_applications_organization_id"),
        table_name="installed_applications",
    )
    op.drop_index(
        op.f("ix_installed_applications_device_id"),
        table_name="installed_applications",
    )
    op.drop_table("installed_applications")
"@ | Set-Content `
            -Path $migrationPath `
            -Encoding UTF8
    }
}

function Apply-Android {
    Assert-File $ModelsKtPath
    Assert-File $HiveApiClientPath
    Assert-File $CommandProcessorPath

    $models = (
        Get-Content $ModelsKtPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $models.Contains(
            "data class InstalledApplicationUpload"
        )
    ) {
        $models += @'

data class InstalledApplicationUpload(
    val packageName: String,
    val appName: String?,
    val versionName: String?,
    val versionCode: Long?,
    val isSystemApp: Boolean,
    val isEnabled: Boolean,
    val firstInstalledAt: String?,
    val lastUpdatedAt: String?,
)

data class InstalledApplicationInventoryResponse(
    val deviceId: String,
    val applicationCount: Int,
    val reportedAt: String,
)
'@
    }

    Set-Content `
        -Path $ModelsKtPath `
        -Value $models `
        -Encoding UTF8

    $client = (
        Get-Content $HiveApiClientPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $client.Contains(
            "suspend fun uploadInstalledApplications"
        )
    ) {
        $anchor = @'
    suspend fun acknowledgeCommand(
'@

        $method = @'
    suspend fun uploadInstalledApplications(
        deviceToken: String,
        applications: List<InstalledApplicationUpload>,
    ): InstalledApplicationInventoryResponse {
        val applicationsJson = JSONArray()

        applications.forEach { application ->
            applicationsJson.put(
                JSONObject().apply {
                    put("package_name", application.packageName)
                    putNullable("app_name", application.appName)
                    putNullable("version_name", application.versionName)
                    putNullable("version_code", application.versionCode)
                    put("is_system_app", application.isSystemApp)
                    put("is_enabled", application.isEnabled)
                    putNullable(
                        "first_installed_at",
                        application.firstInstalledAt,
                    )
                    putNullable(
                        "last_updated_at",
                        application.lastUpdatedAt,
                    )
                },
            )
        }

        val response = post(
            path = "/device-agent/apps",
            token = deviceToken,
            body = JSONObject().put(
                "applications",
                applicationsJson,
            ),
        )

        return InstalledApplicationInventoryResponse(
            deviceId = response.getString("device_id"),
            applicationCount =
                response.getInt("application_count"),
            reportedAt =
                response.getString("reported_at"),
        )
    }

    suspend fun acknowledgeCommand(
'@

        $client = Replace-Exact `
            -Content $client `
            -Old $anchor `
            -New $method `
            -Label "HiveApiClient acknowledgeCommand anchor"
    }

    Set-Content `
        -Path $HiveApiClientPath `
        -Value $client `
        -Encoding UTF8

    $processor = (
        Get-Content $CommandProcessorPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $processor.Contains(
            "InstalledApplicationUpload"
        )
    ) {
        $processor = $processor.Replace(
            "import com.blackbird.hiveagent.api.HiveApiClient",
            "import com.blackbird.hiveagent.api.HiveApiClient`nimport com.blackbird.hiveagent.api.InstalledApplicationUpload"
        )
    }

    if (
        -not $processor.Contains(
            'REFRESH_APPS" ->'
        )
    ) {
        $processor = $processor.Replace(
            '"REQUEST_LOCATION" -> executeRequestLocation(',
           @'
"REFRESH_APPS" -> executeRefreshApps(deviceToken)
            "REQUEST_LOCATION" -> executeRequestLocation(
'@
        )
    }

    if (
        -not $processor.Contains(
            "private suspend fun executeRefreshApps"
        )
    ) {
        $insertBefore = @'
    private fun success(
'@

        $refreshMethod = @'
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
'@

        $processor = Replace-Exact `
            -Content $processor `
            -Old $insertBefore `
            -New $refreshMethod `
            -Label "CommandProcessor success anchor"
    }

    Set-Content `
        -Path $CommandProcessorPath `
        -Value $processor `
        -Encoding UTF8
}

function Apply-Web {
    Assert-File $WebTypesPath
    Assert-File $WebIndexPath
    Assert-File $DeviceDashboardPath
    Assert-File $StylesPath

    $types = (
        Get-Content $WebTypesPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $types.Contains(
            "export interface InstalledApplication"
        )
    ) {
        $types = $types.Replace(
            "/* ---------- Device Locations ---------- */",
            @'
/* ---------- Installed Applications ---------- */

export interface InstalledApplication {
  id: string
  organization_id: string
  device_id: string
  package_name: string
  app_name: string | null
  version_name: string | null
  version_code: number | null
  is_system_app: boolean
  is_enabled: boolean
  first_installed_at: string | null
  last_updated_at: string | null
  reported_at: string
  created_at: string
  updated_at: string
}

/* ---------- Device Locations ---------- */
'@
        )
    }

    Set-Content `
        -Path $WebTypesPath `
        -Value $types `
        -Encoding UTF8

    @'
import { api } from './client'
import { getOrganizationId } from './session'

import type {
  InstalledApplication,
} from './types'

export async function getDeviceApplications(
  deviceId: string,
): Promise<InstalledApplication[]> {
  const organizationId = getOrganizationId()

  return api.get<InstalledApplication[]>(
    `/organizations/${organizationId}/devices/${deviceId}/apps`,
  )
}
'@ | Set-Content `
        -Path (Join-Path $WebApiDir "inventory.ts") `
        -Encoding UTF8

    $index = (
        Get-Content $WebIndexPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $index.Contains(
            "export * from './inventory'"
        )
    ) {
        $index = $index.Replace(
            "export * from './commands'",
            "export * from './commands'`nexport * from './inventory'"
        )
    }

    Set-Content `
        -Path $WebIndexPath `
        -Value $index `
        -Encoding UTF8

    $dashboard = (
        Get-Content $DeviceDashboardPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $dashboard.Contains(
            "getDeviceApplications"
        )
    ) {
        $dashboard = $dashboard.Replace(
            "  getDeviceCommands,",
            "  getDeviceCommands,`n  getDeviceApplications,"
        )

        $dashboard = $dashboard.Replace(
            "  type DeviceLocation,",
            "  type DeviceLocation,`n  type InstalledApplication,"
        )
    }

    $dashboard = $dashboard.Replace(
        "useState<'overview' | 'activity'>(",
        "useState<'overview' | 'activity' | 'applications'>("
    )

    if (
        -not $dashboard.Contains(
            "const [applications, setApplications]"
        )
    ) {
        $stateAnchor = @'
  const [commands, setCommands] =
'@

        $stateBlock = @'
  const [applications, setApplications] =
    useState<InstalledApplication[]>([])

  const [applicationsLoading, setApplicationsLoading] =
    useState(false)

  const [applicationsError, setApplicationsError] =
    useState<string | null>(null)

  const [applications, setApplications] =
'@

        # Use a safer insertion before command state.
        $stateBlock = @'
  const [applications, setApplications] =
    useState<InstalledApplication[]>([])

  const [applicationsLoading, setApplicationsLoading] =
    useState(false)

  const [applicationsError, setApplicationsError] =
    useState<string | null>(null)

  const [commands, setCommands] =
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $stateAnchor `
            -New $stateBlock `
            -Label "dashboard command state anchor"
    }

    if (
        -not $dashboard.Contains(
            "const loadApplications = useCallback"
        )
    ) {
        $handlerAnchor = @'
  const handleRefreshApps = useCallback(
'@

        $loaderAndHandler = @'
  const loadApplications = useCallback(
    async (showLoading = false) => {
      if (!deviceId) {
        return
      }

      try {
        if (showLoading) {
          setApplicationsLoading(true)
        }

        setApplicationsError(null)

        const installedApplications =
          await getDeviceApplications(deviceId)

        setApplications(installedApplications)
      } catch (loadError) {
        setApplicationsError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load installed applications.',
        )
      } finally {
        if (showLoading) {
          setApplicationsLoading(false)
        }
      }
    },
    [deviceId],
  )

  const handleRefreshApps = useCallback(
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $handlerAnchor `
            -New $loaderAndHandler `
            -Label "Refresh Apps handler anchor"
    }

    $oldRefreshHandler = @'
  const handleRefreshApps = useCallback(
    async () => {
      await sendCommand('REFRESH_APPS')
    },
    [sendCommand],
  )
'@

    $newRefreshHandler = @'
  const handleRefreshApps = useCallback(
    async () => {
      await sendCommand('REFRESH_APPS')

      window.setTimeout(() => {
        void loadApplications()
      }, 3_000)

      window.setTimeout(() => {
        void loadApplications()
      }, 8_000)
    },
    [loadApplications, sendCommand],
  )
'@

    if ($dashboard.Contains($oldRefreshHandler)) {
        $dashboard = $dashboard.Replace(
            $oldRefreshHandler,
            $newRefreshHandler
        )
    }

    if (
        -not $dashboard.Contains(
            "void loadApplications(true)"
        )
    ) {
        $dashboard = $dashboard.Replace(
            "  void loadCommands(true)",
            "  void loadCommands(true)`n  void loadApplications(true)"
        )

        $dashboard = $dashboard.Replace(
            "  loadLocation,`n])",
            "  loadLocation,`n  loadApplications,`n])"
        )
    }

    if (
        -not $dashboard.Contains(
            "activeTab === 'applications'"
        )
    ) {
        $tabAnchor = @'
      {activeTab === 'activity' && (
'@

        $applicationsTab = @'
      {activeTab === 'applications' && (
        <section className="device-dashboard-panel">
          <div className="device-dashboard-panel-header">
            <div>
              <p className="eyebrow">
                APPLICATION INVENTORY
              </p>

              <h2>
                Installed applications
              </h2>
            </div>

            <button
              aria-label="Refresh installed applications"
              className="icon-button"
              disabled={applicationsLoading}
              onClick={() =>
                void loadApplications(true)
              }
              type="button"
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  applicationsLoading
                    ? 'spin'
                    : ''
                }
                size={17}
              />
            </button>
          </div>

          <div className="device-applications-summary">
            <strong>
              {applications.length}
            </strong>

            <span>
              applications reported
            </span>
          </div>

          {applicationsLoading &&
          applications.length === 0 ? (
            <div className="device-dashboard-empty">
              <p>
                Loading installed applications...
              </p>
            </div>
          ) : applicationsError ? (
            <p
              className="device-dashboard-command-error"
              role="alert"
            >
              {applicationsError}
            </p>
          ) : applications.length === 0 ? (
            <div className="device-dashboard-empty">
              <p>
                No application inventory has been reported yet.
              </p>

              <p>
                Use Refresh Apps to request an inventory from the device.
              </p>
            </div>
          ) : (
            <div className="device-applications-table-wrapper">
              <table className="device-applications-table">
                <thead>
                  <tr>
                    <th>Application</th>
                    <th>Package</th>
                    <th>Version</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {applications.map(
                    (application) => (
                      <tr key={application.id}>
                        <td>
                          <strong>
                            {application.app_name ??
                              application.package_name}
                          </strong>
                        </td>

                        <td>
                          <code>
                            {application.package_name}
                          </code>
                        </td>

                        <td>
                          {application.version_name ??
                            'Not reported'}
                        </td>

                        <td>
                          <span
                            className={`device-app-type ${
                              application.is_system_app
                                ? 'device-app-type-system'
                                : 'device-app-type-user'
                            }`}
                          >
                            {application.is_system_app
                              ? 'System'
                              : 'User'}
                          </span>
                        </td>

                        <td>
                          {application.is_enabled
                            ? 'Enabled'
                            : 'Disabled'}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'activity' && (
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $tabAnchor `
            -New $applicationsTab `
            -Label "activity tab render anchor"
    }

    # Add Applications tab button before Activity tab button.
    if (
        -not $dashboard.Contains(
            ">Applications<"
        )
    ) {
        $activityButtonPattern =
            '(?s)(<button[^>]*onClick=\{\(\) =>\s*setActiveTab\(''activity''\)[^>]*>.*?</button>)'

        $match =
            [regex]::Match(
                $dashboard,
                $activityButtonPattern
            )

        if ($match.Success) {
            $applicationButton = @'
        <button
          className={
            activeTab === 'applications'
              ? 'device-dashboard-tab active'
              : 'device-dashboard-tab'
          }
          onClick={() =>
            setActiveTab('applications')
          }
          type="button"
        >
          Applications
        </button>

'@

            $dashboard =
                $dashboard.Insert(
                    $match.Index,
                    $applicationButton
                )
        }
        else {
            throw "Could not locate Activity tab button."
        }
    }

    Set-Content `
        -Path $DeviceDashboardPath `
        -Value $dashboard `
        -Encoding UTF8

    $styles = (
        Get-Content $StylesPath -Raw
    ).Replace("`r`n", "`n")

    if (
        -not $styles.Contains(
            ".device-applications-table"
        )
    ) {
        $styles += @'

/* Sprint 02 - installed application inventory */

.device-applications-summary {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 0 16px;
  color: #92929d;
}

.device-applications-summary strong {
  color: #f4f4f5;
  font-size: 1.2rem;
}

.device-applications-table-wrapper {
  overflow-x: auto;
  border: 1px solid #2d2d32;
  border-radius: 12px;
}

.device-applications-table {
  width: 100%;
  min-width: 860px;
  border-collapse: collapse;
}

.device-applications-table th,
.device-applications-table td {
  padding: 13px 15px;
  border-bottom: 1px solid #29292e;
  text-align: left;
  vertical-align: middle;
}

.device-applications-table th {
  background: #19191c;
  color: #7f7f8a;
  font-size: 0.67rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.device-applications-table td {
  color: #b4b4bd;
  font-size: 0.76rem;
}

.device-applications-table td strong {
  color: #f4f4f5;
}

.device-applications-table td code {
  color: #d4d4d8;
  overflow-wrap: anywhere;
}

.device-applications-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.018);
}

.device-applications-table tbody tr:last-child td {
  border-bottom: 0;
}

.device-app-type {
  display: inline-flex;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.device-app-type-user {
  background: rgba(34, 197, 94, 0.13);
  color: #86efac;
}

.device-app-type-system {
  background: rgba(113, 113, 122, 0.17);
  color: #d4d4d8;
}
'@
    }

    Set-Content `
        -Path $StylesPath `
        -Value $styles `
        -Encoding UTF8
}

function Apply-Sprint {
    Apply-Backend
    Apply-Android
    Apply-Web

    Write-Host ""
    Write-Host "$SprintName applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "Added:"
    Write-Host "  - Inventory repository/service/router"
    Write-Host "  - Device-authenticated inventory upload endpoint"
    Write-Host "  - Organisation-scoped inventory read endpoint"
    Write-Host "  - Alembic installed_applications migration"
    Write-Host "  - Android installed-package scanner"
    Write-Host "  - REFRESH_APPS execution + upload"
    Write-Host "  - Web inventory API/types"
    Write-Host "  - Device Applications tab"
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  .\scripts\run-sprint.ps1 -Sprint 2 -Mode Validate"
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "[1/6] Git diff" -ForegroundColor Cyan
    git diff --stat

    Write-Host ""
    Write-Host "[2/6] API import smoke test" -ForegroundColor Cyan
    docker compose exec api python -c "from hive.modules.inventory.router import router; from hive.modules.inventory.models import InstalledApplication; print('Inventory API OK')"

    if ($LASTEXITCODE -ne 0) {
        throw "Inventory API import failed."
    }

    Write-Host ""
    Write-Host "[3/6] Alembic upgrade" -ForegroundColor Cyan
    docker compose exec api alembic upgrade head

    if ($LASTEXITCODE -ne 0) {
        throw "Alembic upgrade failed."
    }

    Write-Host ""
    Write-Host "[4/6] Web production build" -ForegroundColor Cyan

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

    Write-Host ""
    Write-Host "[5/6] Android debug build" -ForegroundColor Cyan

    Push-Location (
        Join-Path $RepoRoot "apps\android-agent"
    )
    try {
        .\gradlew.bat :app:assembleDebug

        if ($LASTEXITCODE -ne 0) {
            throw "Android build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[6/6] Sprint assertions" -ForegroundColor Cyan

    $requiredFiles = @(
        (Join-Path $InventoryDir "repository.py"),
        (Join-Path $InventoryDir "service.py"),
        (Join-Path $InventoryDir "router.py"),
        (Join-Path $WebApiDir "inventory.ts")
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            throw "Missing expected file: $file"
        }
    }

    $processor = Get-Content $CommandProcessorPath -Raw
    $dashboard = Get-Content $DeviceDashboardPath -Raw

    foreach ($marker in @(
        "executeRefreshApps",
        "uploadInstalledApplications"
    )) {
        if (-not $processor.Contains($marker)) {
            throw "Android validation missing: $marker"
        }
    }

    foreach ($marker in @(
        "getDeviceApplications",
        "Installed applications",
        "applications"
    )) {
        if (-not $dashboard.Contains($marker)) {
            throw "Web validation missing: $marker"
        }
    }

    Write-Host ""
    Write-Host "Sprint 02 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual test:"
    Write-Host "  1. Reinstall the debug APK on the Unitech."
    Write-Host "  2. Open Hive Agent once."
    Write-Host "  3. In Hive, press Refresh Apps."
    Write-Host "  4. Wait around 10 seconds for automatic command pickup."
    Write-Host "  5. Confirm REFRESH_APPS becomes COMPLETED."
    Write-Host "  6. Open the Applications tab."
    Write-Host "  7. Confirm package names, versions and system/user state appear."
}

switch ($Mode) {
    "Apply" {
        Apply-Sprint
    }

    "Validate" {
        Validate-Sprint
    }
}
