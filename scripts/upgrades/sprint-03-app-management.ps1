param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 03 - App Management"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$CommandModelsPath = Join-Path $RepoRoot "apps\api\src\hive\modules\device_commands\models.py"
$AlembicVersionsDir = Join-Path $RepoRoot "apps\api\alembic\versions"
$CommandProcessorPath = Join-Path $RepoRoot "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt"
$DashboardPath = Join-Path $RepoRoot "apps\web\src\pages\DeviceDashboard.tsx"
$ComponentDir = Join-Path $RepoRoot "apps\web\src\components\devices"
$ApplicationPanelPath = Join-Path $ComponentDir "ApplicationInventoryPanel.tsx"
$StylesPath = Join-Path $RepoRoot "apps\web\src\styles\index.css"

$MigrationRevision = "c31fd5a17b42"
$MigrationFile = Join-Path $AlembicVersionsDir "${MigrationRevision}_add_app_management_commands.py"

function Assert-File {
    param([string]$Path)
    if (-not (Test-Path $Path)) { throw "Required file not found: $Path" }
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
    Assert-File $CommandModelsPath

    $models = (Get-Content $CommandModelsPath -Raw).Replace("`r`n", "`n")

    if (-not $models.Contains('LAUNCH_APP = "LAUNCH_APP"')) {
        $models = Replace-Exact `
            -Content $models `
            -Old '    REFRESH_APPS = "REFRESH_APPS"' `
            -New @'
    REFRESH_APPS = "REFRESH_APPS"
    LAUNCH_APP = "LAUNCH_APP"
    FORCE_STOP_APP = "FORCE_STOP_APP"
    UNINSTALL_APP = "UNINSTALL_APP"
'@ `
            -Label "DeviceCommandType REFRESH_APPS"
    }

    Set-Content $CommandModelsPath $models -Encoding UTF8

    if (-not (Test-Path $MigrationFile)) {
        $downRevision = Get-AlembicHead

        @"
"""add app management commands

Revision ID: $MigrationRevision
Revises: $downRevision
Create Date: 2026-08-12
"""

from typing import Sequence, Union
from alembic import op

revision: str = "$MigrationRevision"
down_revision: Union[str, None] = "$downRevision"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TYPE device_command_type "
        "ADD VALUE IF NOT EXISTS 'LAUNCH_APP'"
    )
    op.execute(
        "ALTER TYPE device_command_type "
        "ADD VALUE IF NOT EXISTS 'FORCE_STOP_APP'"
    )
    op.execute(
        "ALTER TYPE device_command_type "
        "ADD VALUE IF NOT EXISTS 'UNINSTALL_APP'"
    )


def downgrade() -> None:
    # PostgreSQL cannot safely drop enum members without rebuilding
    # dependent columns. Retaining these values is safe.
    pass
"@ | Set-Content $MigrationFile -Encoding UTF8
    }
}

function Apply-Android {
    Assert-File $CommandProcessorPath

    $content = (Get-Content $CommandProcessorPath -Raw).Replace("`r`n", "`n")

    if (-not $content.Contains("import android.content.Intent")) {
        $content = Replace-Exact `
            -Content $content `
            -Old "import android.content.Context" `
            -New "import android.content.Context`nimport android.content.Intent" `
            -Label "Context import"
    }

    if (-not $content.Contains("import android.net.Uri")) {
        $content = Replace-Exact `
            -Content $content `
            -Old "import android.media.RingtoneManager" `
            -New "import android.media.RingtoneManager`nimport android.net.Uri" `
            -Label "RingtoneManager import"
    }

    if (-not $content.Contains('"LAUNCH_APP" -> executeLaunchApp(command)')) {
        $content = Replace-Exact `
            -Content $content `
            -Old @'
            "REFRESH_APPS" -> executeRefreshApps(deviceToken)
            "REQUEST_LOCATION" -> executeRequestLocation(
'@ `
            -New @'
            "REFRESH_APPS" -> executeRefreshApps(deviceToken)
            "LAUNCH_APP" -> executeLaunchApp(command)
            "FORCE_STOP_APP" -> executeForceStopApp(command)
            "UNINSTALL_APP" -> executeUninstallApp(command)
            "REQUEST_LOCATION" -> executeRequestLocation(
'@ `
            -Label "command dispatch"
    }

    if (-not $content.Contains("private fun executeLaunchApp(")) {
        $methods = @'
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

'@

        $anchor = "    private suspend fun executeRefreshApps("
        if (-not $content.Contains($anchor)) {
            throw "Could not find executeRefreshApps anchor."
        }
        $content = $content.Replace($anchor, $methods + $anchor)
    }

    Set-Content $CommandProcessorPath $content -Encoding UTF8
}

function Apply-Web {
    Assert-File $DashboardPath
    Assert-File $StylesPath
    New-Item -ItemType Directory -Path $ComponentDir -Force | Out-Null

    @'
import {
  OctagonX,
  Play,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type {
  InstalledApplication,
} from '../../lib/api'

type ApplicationCommand =
  | 'LAUNCH_APP'
  | 'FORCE_STOP_APP'
  | 'UNINSTALL_APP'

type ApplicationFilter =
  | 'all'
  | 'user'
  | 'system'
  | 'enabled'
  | 'disabled'

type Props = {
  applications: InstalledApplication[]
  loading: boolean
  error: string | null
  sendingCommand: string | null
  onReload: () => void
  onRefreshInventory: () => Promise<void>
  onCommand: (
    command: ApplicationCommand,
    application: InstalledApplication,
  ) => Promise<void>
}

export function ApplicationInventoryPanel({
  applications,
  loading,
  error,
  sendingCommand,
  onReload,
  onRefreshInventory,
  onCommand,
}: Props) {
  const [searchQuery, setSearchQuery] =
    useState('')
  const [filter, setFilter] =
    useState<ApplicationFilter>('all')

  const filteredApplications = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return applications.filter((application) => {
      const name =
        application.app_name ??
        application.package_name

      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        application.package_name
          .toLowerCase()
          .includes(query) ||
        (application.version_name ?? '')
          .toLowerCase()
          .includes(query)

      if (!matchesSearch) {
        return false
      }

      switch (filter) {
        case 'user':
          return !application.is_system_app
        case 'system':
          return application.is_system_app
        case 'enabled':
          return application.is_enabled
        case 'disabled':
          return !application.is_enabled
        default:
          return true
      }
    })
  }, [applications, filter, searchQuery])

  async function handleCommand(
    command: ApplicationCommand,
    application: InstalledApplication,
  ) {
    const name =
      application.app_name ??
      application.package_name

    if (
      command === 'FORCE_STOP_APP' &&
      !window.confirm(
        `Request force stop for ${name}? Standard Android agents may reject this action.`,
      )
    ) {
      return
    }

    if (
      command === 'UNINSTALL_APP' &&
      !window.confirm(
        `Request uninstall for ${name}? Android will require confirmation on the device.`,
      )
    ) {
      return
    }

    await onCommand(command, application)
  }

  return (
    <section className="device-dashboard-panel">
      <div className="device-dashboard-panel-header">
        <div>
          <p className="eyebrow">
            APPLICATION MANAGEMENT
          </p>
          <h2>Installed applications</h2>
        </div>

        <button
          aria-label="Reload application inventory"
          className="icon-button"
          disabled={loading}
          onClick={onReload}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={loading ? 'spin' : ''}
            size={17}
          />
        </button>
      </div>

      <div className="device-applications-toolbar">
        <label className="device-app-search">
          <Search aria-hidden="true" size={16} />
          <input
            aria-label="Search installed applications"
            onChange={(event) =>
              setSearchQuery(event.target.value)
            }
            placeholder="Search app, package or version..."
            type="search"
            value={searchQuery}
          />
        </label>

        <select
          aria-label="Filter installed applications"
          className="device-app-filter"
          onChange={(event) =>
            setFilter(
              event.target.value as ApplicationFilter,
            )
          }
          value={filter}
        >
          <option value="all">All apps</option>
          <option value="user">User apps</option>
          <option value="system">System apps</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>

        <button
          className="secondary-button"
          disabled={sendingCommand !== null || loading}
          onClick={() =>
            void onRefreshInventory()
          }
          type="button"
        >
          Refresh from device
        </button>
      </div>

      <div className="device-applications-summary">
        <strong>{filteredApplications.length}</strong>
        <span>
          shown of {applications.length} reported
        </span>
      </div>

      <p className="device-app-management-note">
        Launch works for apps with a launchable activity.
        Force stop requires privileged Android/OEM management.
        Uninstall opens Android confirmation on this non-device-owner device.
      </p>

      {loading && applications.length === 0 ? (
        <div className="device-dashboard-empty">
          <p>Loading installed applications...</p>
        </div>
      ) : error ? (
        <p
          className="device-dashboard-command-error"
          role="alert"
        >
          {error}
        </p>
      ) : applications.length === 0 ? (
        <div className="device-dashboard-empty">
          <p>No application inventory has been reported yet.</p>
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="device-dashboard-empty">
          <p>No applications match the current search or filter.</p>
        </div>
      ) : (
        <div className="device-applications-table-wrapper">
          <table className="device-applications-table device-applications-management-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Package</th>
                <th>Version</th>
                <th>Type</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredApplications.map((application) => {
                const name =
                  application.app_name ??
                  application.package_name

                return (
                  <tr key={application.id}>
                    <td><strong>{name}</strong></td>
                    <td><code>{application.package_name}</code></td>
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
                    <td>
                      <div className="device-app-actions">
                        <button
                          className="device-app-action"
                          disabled={sendingCommand !== null}
                          onClick={() =>
                            void handleCommand(
                              'LAUNCH_APP',
                              application,
                            )
                          }
                          type="button"
                        >
                          <Play aria-hidden="true" size={15} />
                          Launch
                        </button>

                        <button
                          className="device-app-action"
                          disabled={sendingCommand !== null}
                          onClick={() =>
                            void handleCommand(
                              'FORCE_STOP_APP',
                              application,
                            )
                          }
                          title="Requires privileged Android/OEM management"
                          type="button"
                        >
                          <OctagonX aria-hidden="true" size={15} />
                          Stop
                        </button>

                        <button
                          className="device-app-action device-app-action-danger"
                          disabled={
                            sendingCommand !== null ||
                            application.is_system_app
                          }
                          onClick={() =>
                            void handleCommand(
                              'UNINSTALL_APP',
                              application,
                            )
                          }
                          type="button"
                        >
                          <Trash2 aria-hidden="true" size={15} />
                          Uninstall
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
'@ | Set-Content $ApplicationPanelPath -Encoding UTF8

    $dashboard = (Get-Content $DashboardPath -Raw).Replace("`r`n", "`n")

    if (-not $dashboard.Contains("ApplicationInventoryPanel")) {
        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old "import { StatusBadge } from '../components/devices/StatusBadge'" `
            -New "import { ApplicationInventoryPanel } from '../components/devices/ApplicationInventoryPanel'`nimport { StatusBadge } from '../components/devices/StatusBadge'" `
            -Label "StatusBadge import"
    }

    if (-not $dashboard.Contains("const handleApplicationCommand = useCallback")) {
        $anchor = @'
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

        $replacement = $anchor + @'

  const handleApplicationCommand = useCallback(
    async (
      command:
        | 'LAUNCH_APP'
        | 'FORCE_STOP_APP'
        | 'UNINSTALL_APP',
      application: InstalledApplication,
    ) => {
      await sendCommand(command, {
        package_name: application.package_name,
        app_name: application.app_name,
      })

      if (command === 'UNINSTALL_APP') {
        window.setTimeout(() => {
          void loadApplications()
        }, 12_000)
      }
    },
    [loadApplications, sendCommand],
  )
'@

        $dashboard = Replace-Exact `
            -Content $dashboard `
            -Old $anchor `
            -New $replacement `
            -Label "handleRefreshApps"
    }

    if (-not $dashboard.Contains("<ApplicationInventoryPanel")) {
        $pattern =
            "(?s)      \{activeTab === 'applications' && \(\n.*?\n      \)\}\n\n      \{activeTab === 'activity' && \("

        $replacementBlock = @'
      {activeTab === 'applications' && (
        <ApplicationInventoryPanel
          applications={applications}
          error={applicationsError}
          loading={applicationsLoading}
          onCommand={handleApplicationCommand}
          onRefreshInventory={handleRefreshApps}
          onReload={() =>
            void loadApplications(true)
          }
          sendingCommand={sendingCommand}
        />
      )}

      {activeTab === 'activity' && (
'@

        $updated = [regex]::Replace(
            $dashboard,
            $pattern,
            $replacementBlock,
            1
        )

        if ($updated -eq $dashboard) {
            throw "Could not replace Applications tab block."
        }

        $dashboard = $updated
    }


    Set-Content $DashboardPath $dashboard -Encoding UTF8

    $styles = (Get-Content $StylesPath -Raw).Replace("`r`n", "`n")

    if (-not $styles.Contains("/* Sprint 03 - app management */")) {
        $styles += @'

/* Sprint 03 - app management */

.device-applications-toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) auto auto;
  gap: 10px;
  margin: 8px 0 12px;
}

.device-app-search {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 0 11px;
  border: 1px solid #303036;
  border-radius: 10px;
  background: #141416;
  color: #74747f;
}

.device-app-search:focus-within {
  border-color: #facc15;
  outline: 2px solid rgba(250, 204, 21, 0.12);
}

.device-app-search input {
  width: 100%;
  min-width: 0;
  padding: 10px 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #f4f4f5;
  font: inherit;
}

.device-app-filter {
  padding: 0 12px;
  border: 1px solid #303036;
  border-radius: 10px;
  background: #141416;
  color: #f4f4f5;
  font: inherit;
}

.device-app-management-note {
  margin: 0 0 15px;
  color: #7f7f8a;
  font-size: 0.72rem;
  line-height: 1.6;
}

.device-applications-management-table {
  min-width: 1180px;
}

.device-app-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.device-app-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 30px;
  padding: 5px 8px;
  border: 1px solid #34343a;
  border-radius: 8px;
  background: #19191c;
  color: #d4d4d8;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
}

.device-app-action:hover:not(:disabled) {
  border-color: #52525b;
  background: #222226;
  color: #ffffff;
}

.device-app-action:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.device-app-action-danger {
  border-color: rgba(239, 68, 68, 0.28);
  color: #fca5a5;
}

@media (max-width: 860px) {
  .device-applications-toolbar {
    grid-template-columns: 1fr;
  }

  .device-app-filter,
  .device-applications-toolbar .secondary-button {
    min-height: 42px;
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
    Write-Host "Added LAUNCH_APP, FORCE_STOP_APP, UNINSTALL_APP, search/filtering and per-app controls."
    Write-Host ""
    Write-Host "Next:"
    Write-Host "  docker compose up -d --build api"
    Write-Host "  .\scripts\run-sprint.ps1 -Sprint 3 -Mode Validate"
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Yellow

    Write-Host "`n[1/7] Git diff" -ForegroundColor Cyan
    git diff --stat

    Write-Host "`n[2/7] Rebuild API container" -ForegroundColor Cyan
    docker compose up -d --build api
    if ($LASTEXITCODE -ne 0) { throw "API container build failed." }

    Write-Host "`n[3/7] Alembic upgrade" -ForegroundColor Cyan
    cmd.exe /c "docker compose exec -T api alembic upgrade head"
    if ($LASTEXITCODE -ne 0) { throw "Alembic upgrade failed." }

    Write-Host "`n[4/7] API command smoke test" -ForegroundColor Cyan
    docker compose exec -T api python -c "from hive.modules.device_commands.models import DeviceCommandType; expected={'LAUNCH_APP','FORCE_STOP_APP','UNINSTALL_APP'}; actual={x.value for x in DeviceCommandType}; assert expected <= actual; print('Sprint 03 command API OK')"
    if ($LASTEXITCODE -ne 0) { throw "API command smoke test failed." }

    Write-Host "`n[5/7] Web production build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\web")
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "Web build failed." }
    }
    finally { Pop-Location }

    Write-Host "`n[6/7] Android debug build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\android-agent")
    try {
        .\gradlew.bat :app:assembleDebug
        if ($LASTEXITCODE -ne 0) { throw "Android build failed." }
    }
    finally { Pop-Location }

    Write-Host "`n[7/7] Sprint assertions" -ForegroundColor Cyan

    Assert-File $ApplicationPanelPath
    Assert-File $MigrationFile

    $models = Get-Content $CommandModelsPath -Raw
    $processor = Get-Content $CommandProcessorPath -Raw
    $dashboard = Get-Content $DashboardPath -Raw
    $panel = Get-Content $ApplicationPanelPath -Raw

    foreach ($command in @(
        "LAUNCH_APP",
        "FORCE_STOP_APP",
        "UNINSTALL_APP"
    )) {
        if (-not $models.Contains($command)) {
            throw "Backend missing command: $command"
        }
        if (-not $processor.Contains($command)) {
            throw "Android missing command: $command"
        }
        if (-not $panel.Contains($command)) {
            throw "Web panel missing command: $command"
        }
    }

    if (-not $dashboard.Contains("ApplicationInventoryPanel")) {
        throw "Dashboard missing ApplicationInventoryPanel."
    }

    Write-Host ""
    Write-Host "Sprint 03 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual test:"
    Write-Host "  1. Install the new APK on the Unitech."
    Write-Host "  2. Open Applications and test search/filter."
    Write-Host "  3. Launch a normal user app."
    Write-Host "  4. Force Stop should return the privilege limitation."
    Write-Host "  5. Uninstall only a disposable user app; Android should request confirmation."
}

function Collect-Sprint {
    Write-Host "Sprint 03 context has already been collected." -ForegroundColor Yellow
}

switch ($Mode) {
    "Collect" { Collect-Sprint }
    "Apply" { Apply-Sprint }
    "Validate" { Validate-Sprint }
}
