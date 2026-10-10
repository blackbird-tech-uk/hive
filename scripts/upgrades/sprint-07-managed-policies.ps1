param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Apply"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 07 - Managed Policies"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Read-Text([string]$RelativePath) {
    $path = Join-Path $RepoRoot $RelativePath
    if (-not (Test-Path $path)) {
        throw "Sprint 07 could not find $RelativePath."
    }
    return [System.IO.File]::ReadAllText($path)
}

function Write-Text([string]$RelativePath, [string]$Content) {
    $path = Join-Path $RepoRoot $RelativePath
    [System.IO.File]::WriteAllText(
        $path,
        $Content,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Replace-Once(
    [string]$Content,
    [string]$Old,
    [string]$New,
    [string]$Description
) {
    $index = $Content.IndexOf($Old)
    if ($index -lt 0) {
        throw "Sprint 07 could not find $Description."
    }

    if ($Content.IndexOf($Old, $index + $Old.Length) -ge 0) {
        throw "Sprint 07 found more than one $Description."
    }

    return $Content.Substring(0, $index) +
        $New +
        $Content.Substring($index + $Old.Length)
}

function Assert-Contains(
    [string]$RelativePath,
    [string]$Pattern,
    [string]$Description
) {
    $content = Read-Text $RelativePath

    if ($content -notmatch $Pattern) {
        throw "[FAIL] $Description"
    }

    Write-Host "[PASS] $Description" -ForegroundColor Green
}

function Apply-Sprint {
    Write-Host ""
    Write-Host "Applying $SprintName" -ForegroundColor Cyan

    # ------------------------------------------------------------------
    # Android Device Admin declaration
    # ------------------------------------------------------------------
    $file = "apps\android-agent\app\src\main\res\xml\device_admin_receiver.xml"
    $content = Read-Text $file

    if ($content -notmatch "<expire-password\s*/>") {
        $content = Replace-Once $content `
            "        <disable-camera />" `
            "        <disable-camera />`r`n        <expire-password />" `
            "Device Admin camera policy declaration"

        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Android heartbeat model
    # ------------------------------------------------------------------
    $file = "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\Models.kt"
    $content = Read-Text $file

  if (
    $content -notmatch "supportsCameraPolicy" -or
    $content -notmatch "supportsLockTimeoutPolicy" -or
    $content -notmatch "cameraDisabled" -or
    $content -notmatch "maximumTimeToLockMs"
) {
        $old = @'
    val supportsDeviceLock: Boolean?,
    val isLockTaskActive: Boolean?,
)
'@
        $new = @'
    val supportsDeviceLock: Boolean?,
    val isLockTaskActive: Boolean?,
    val supportsCameraPolicy: Boolean?,
    val supportsLockTimeoutPolicy: Boolean?,
    val cameraDisabled: Boolean?,
    val maximumTimeToLockMs: Long?,
)
'@
        $content = Replace-Once $content $old $new "Android heartbeat policy fields"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Android API heartbeat JSON
    # ------------------------------------------------------------------
    $file = "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\HiveApiClient.kt"
    $content = Read-Text $file

    if ($content -notmatch '"supports_camera_policy"') {
        $old = @'
            putNullable("supports_device_lock", payload.supportsDeviceLock)
            putNullable("is_lock_task_active", payload.isLockTaskActive)
'@
        $new = @'
            putNullable("supports_device_lock", payload.supportsDeviceLock)
            putNullable("is_lock_task_active", payload.isLockTaskActive)
            putNullable("supports_camera_policy", payload.supportsCameraPolicy)
            putNullable("supports_lock_timeout_policy", payload.supportsLockTimeoutPolicy)
            putNullable("camera_disabled", payload.cameraDisabled)
            putNullable("maximum_time_to_lock_ms", payload.maximumTimeToLockMs)
'@
        $content = Replace-Once $content $old $new "Android heartbeat JSON policy fields"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Android telemetry
    # ------------------------------------------------------------------
    $file = "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\device\DeviceInfoProvider.kt"
    $content = Read-Text $file

    if ($content -notmatch "supportsCameraPolicy") {
        $old = @'
        val supportsDeviceLock =
            isDeviceOwner || isDeviceAdmin

        val activityManager =
'@
        $new = @'
        val supportsDeviceLock =
            isDeviceOwner || isDeviceAdmin

        val supportsCameraPolicy =
            isDeviceOwner || isDeviceAdmin

        val supportsLockTimeoutPolicy =
            isDeviceOwner || isDeviceAdmin

        val cameraDisabled =
            if (supportsCameraPolicy) {
                try {
                    devicePolicyManager.getCameraDisabled(
                        adminComponent,
                    )
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }

        val maximumTimeToLockMs =
            if (supportsLockTimeoutPolicy) {
                try {
                    devicePolicyManager.getMaximumTimeToLock(
                        adminComponent,
                    )
                } catch (_: Exception) {
                    null
                }
            } else {
                null
            }

        val activityManager =
'@
        $content = Replace-Once $content $old $new "DeviceInfoProvider capability block"

        $old = @'
            isLockTaskActive =
                isLockTaskActive,
        )
'@
        $new = @'
            isLockTaskActive =
                isLockTaskActive,
            supportsCameraPolicy =
                supportsCameraPolicy,
            supportsLockTimeoutPolicy =
                supportsLockTimeoutPolicy,
            cameraDisabled =
                cameraDisabled,
            maximumTimeToLockMs =
                maximumTimeToLockMs,
        )
'@
        $content = Replace-Once $content $old $new "DeviceInfoProvider heartbeat return block"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Android command processor
    # ------------------------------------------------------------------
    $file = "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt"
    $content = Read-Text $file

    if ($content -notmatch '"SET_CAMERA_DISABLED"') {
        $old = @'
            "LOCK_DEVICE" -> executeLockDevice()

            else -> failure(
'@
        $new = @'
            "LOCK_DEVICE" -> executeLockDevice()
            "SET_CAMERA_DISABLED" -> executeSetCameraDisabled(command)
            "SET_LOCK_TIMEOUT" -> executeSetLockTimeout(command)

            else -> failure(
'@
        $content = Replace-Once $content $old $new "CommandProcessor command switch"

        $marker = @'
    private fun executeLockDevice(): CommandExecutionResult {
'@

        $methods = @'
    private fun hasManagedPolicyCapability(): Boolean {
        return devicePolicyManager.isDeviceOwnerApp(
            context.packageName,
        ) || devicePolicyManager.isAdminActive(
            adminComponent,
        )
    }

    private fun executeSetCameraDisabled(
        command: DeviceCommand,
    ): CommandExecutionResult {
        if (!hasManagedPolicyCapability()) {
            return failure(
                "Camera policy requires active Device Admin or Device Owner capability.",
            )
        }

        val disabled = when (
            val value = command.payload["disabled"]
        ) {
            is Boolean -> value
            is String -> value.toBooleanStrictOrNull()
            else -> null
        } ?: return failure(
            "SET_CAMERA_DISABLED payload requires a boolean disabled value.",
        )

        return try {
            devicePolicyManager.setCameraDisabled(
                adminComponent,
                disabled,
            )

            success(
                if (disabled) {
                    "Camera disabled by Hive policy."
                } else {
                    "Camera enabled by Hive policy."
                },
            )
        } catch (exception: SecurityException) {
            failure(
                exception.message
                    ?: "Android rejected the camera policy request.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to update the camera policy.",
            )
        }
    }

    private fun executeSetLockTimeout(
        command: DeviceCommand,
    ): CommandExecutionResult {
        if (!hasManagedPolicyCapability()) {
            return failure(
                "Screen lock timeout policy requires active Device Admin or Device Owner capability.",
            )
        }

        val timeoutMs = when (
            val value = command.payload["timeout_ms"]
        ) {
            is Number -> value.toLong()
            is String -> value.toLongOrNull()
            else -> null
        } ?: return failure(
            "SET_LOCK_TIMEOUT payload requires timeout_ms.",
        )

        if (timeoutMs < 0L || timeoutMs > 86_400_000L) {
            return failure(
                "Screen lock timeout must be between 0 and 86400000 milliseconds.",
            )
        }

        return try {
            devicePolicyManager.setMaximumTimeToLock(
                adminComponent,
                timeoutMs,
            )

            success(
                if (timeoutMs == 0L) {
                    "Hive screen lock timeout restriction cleared."
                } else {
                    "Hive screen lock timeout set to ${timeoutMs / 60_000L} minute(s)."
                },
            )
        } catch (exception: SecurityException) {
            failure(
                exception.message
                    ?: "Android rejected the screen lock timeout policy.",
            )
        } catch (exception: Exception) {
            failure(
                exception.message
                    ?: "Unable to update the screen lock timeout policy.",
            )
        }
    }

'@

        $content = Replace-Once $content $marker ($methods + $marker) "CommandProcessor lock method"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # API command enum
    # ------------------------------------------------------------------
    $file = "apps\api\src\hive\modules\device_commands\models.py"
    $content = Read-Text $file

    if ($content -notmatch 'SET_CAMERA_DISABLED = "SET_CAMERA_DISABLED"') {
        $old = '    LOCK_DEVICE = "LOCK_DEVICE"'
        $new = @'
    LOCK_DEVICE = "LOCK_DEVICE"
    SET_CAMERA_DISABLED = "SET_CAMERA_DISABLED"
    SET_LOCK_TIMEOUT = "SET_LOCK_TIMEOUT"
'@
        $content = Replace-Once $content $old $new "API device command enum"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Device database model
    # ------------------------------------------------------------------
    $file = "apps\api\src\hive\modules\devices\models.py"
    $content = Read-Text $file

    if ($content -notmatch "supports_camera_policy") {
        $old = @'
    is_lock_task_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )
    battery_level: Mapped[int | None] = mapped_column(
'@
        $new = @'
    is_lock_task_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    supports_camera_policy: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    supports_lock_timeout_policy: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    camera_disabled: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    maximum_time_to_lock_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    desired_camera_disabled: Mapped[bool | None] = mapped_column(
        Boolean,
        nullable=True,
    )

    desired_maximum_time_to_lock_ms: Mapped[int | None] = mapped_column(
        Integer,
        nullable=True,
    )

    battery_level: Mapped[int | None] = mapped_column(
'@
        $content = Replace-Once $content $old $new "Device policy model fields"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Device API response
    # ------------------------------------------------------------------
    $file = "apps\api\src\hive\modules\devices\schemas.py"
    $content = Read-Text $file

    if ($content -notmatch "supports_camera_policy") {
        $old = @'
    supports_device_lock: bool
    is_lock_task_active: bool
    battery_level: int | None
'@
        $new = @'
    supports_device_lock: bool
    is_lock_task_active: bool
    supports_camera_policy: bool
    supports_lock_timeout_policy: bool
    camera_disabled: bool | None
    maximum_time_to_lock_ms: int | None
    desired_camera_disabled: bool | None
    desired_maximum_time_to_lock_ms: int | None
    battery_level: int | None
'@
        $content = Replace-Once $content $old $new "Device response policy fields"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Agent schemas
    # ------------------------------------------------------------------
    $file = "apps\api\src\hive\modules\device_agent\schemas.py"
    $content = Read-Text $file

    if ($content -notmatch "supports_camera_policy") {
        $old = @'
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None
    enrolled_at: datetime | None = None
'@
        $new = @'
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None
    supports_camera_policy: bool | None = None
    supports_lock_timeout_policy: bool | None = None
    camera_disabled: bool | None = None
    maximum_time_to_lock_ms: int | None = None
    enrolled_at: datetime | None = None
'@
        $content = Replace-Once $content $old $new "DeviceAgentResponse policy fields"

        $old = @'
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None


class DeviceCommandDelivery
'@
        $new = @'
    supports_device_lock: bool | None = None
    is_lock_task_active: bool | None = None
    supports_camera_policy: bool | None = None
    supports_lock_timeout_policy: bool | None = None
    camera_disabled: bool | None = None
    maximum_time_to_lock_ms: int | None = Field(
        default=None,
        ge=0,
        le=86_400_000,
    )


class DeviceCommandDelivery
'@
        $content = Replace-Once $content $old $new "DeviceHeartbeatRequest policy fields"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Agent heartbeat persistence
    # ------------------------------------------------------------------
    $file = "apps\api\src\hive\modules\device_agent\service.py"
    $content = Read-Text $file

    if ($content -notmatch "payload.supports_camera_policy") {
        $old = @'
        if payload.is_lock_task_active is not None:
            device.is_lock_task_active = payload.is_lock_task_active
        delivered_commands: list[
'@
        $new = @'
        if payload.is_lock_task_active is not None:
            device.is_lock_task_active = payload.is_lock_task_active

        if payload.supports_camera_policy is not None:
            device.supports_camera_policy = payload.supports_camera_policy

        if payload.supports_lock_timeout_policy is not None:
            device.supports_lock_timeout_policy = (
                payload.supports_lock_timeout_policy
            )

        if payload.camera_disabled is not None:
            device.camera_disabled = payload.camera_disabled

        if payload.maximum_time_to_lock_ms is not None:
            device.maximum_time_to_lock_ms = (
                payload.maximum_time_to_lock_ms
            )

        delivered_commands: list[
'@
        $content = Replace-Once $content $old $new "heartbeat policy persistence"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Command validation + desired policy state
    # ------------------------------------------------------------------
    $file = "apps\api\src\hive\modules\device_commands\service.py"
    $content = Read-Text $file

    if ($content -notmatch "_validate_policy_command") {
        $old = @'
        command = DeviceCommand(
            device_id=device.id,
            command=payload.command,
            payload=payload.payload,
        )
'@
        $new = @'
        self._validate_policy_command(
            device=device,
            payload=payload,
        )

        command = DeviceCommand(
            device_id=device.id,
            command=payload.command,
            payload=payload.payload,
        )

        if payload.command.value == "SET_CAMERA_DISABLED":
            device.desired_camera_disabled = bool(
                (payload.payload or {})["disabled"]
            )

        if payload.command.value == "SET_LOCK_TIMEOUT":
            device.desired_maximum_time_to_lock_ms = int(
                (payload.payload or {})["timeout_ms"]
            )
'@
        $content = Replace-Once $content $old $new "command creation policy hook"

        $marker = @'
    def list_device_commands(
'@
        $methods = @'
    @staticmethod
    def _validate_policy_command(
        *,
        device,
        payload: DeviceCommandCreate,
    ) -> None:
        command = payload.command.value
        command_payload = payload.payload or {}

        if command == "SET_CAMERA_DISABLED":
            if not device.supports_camera_policy:
                raise ValueError(
                    "Camera policy is unavailable on this device."
                )

            disabled = command_payload.get("disabled")

            if not isinstance(disabled, bool):
                raise ValueError(
                    "SET_CAMERA_DISABLED requires a boolean disabled value."
                )

        if command == "SET_LOCK_TIMEOUT":
            if not device.supports_lock_timeout_policy:
                raise ValueError(
                    "Screen lock timeout policy is unavailable on this device."
                )

            timeout_ms = command_payload.get("timeout_ms")

            if (
                isinstance(timeout_ms, bool)
                or not isinstance(timeout_ms, int)
                or timeout_ms < 0
                or timeout_ms > 86_400_000
            ):
                raise ValueError(
                    "SET_LOCK_TIMEOUT requires timeout_ms between 0 and 86400000."
                )

'@
        $content = Replace-Once $content $marker ($methods + $marker) "command service list method"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Web types
    # ------------------------------------------------------------------
    $file = "apps\web\src\lib\api\types.ts"
    $content = Read-Text $file

    if ($content -notmatch "supports_camera_policy") {
        $old = @'
  supports_device_lock: boolean
  is_lock_task_active: boolean
  battery_level: number | null
'@
        $new = @'
  supports_device_lock: boolean
  is_lock_task_active: boolean
  supports_camera_policy: boolean
  supports_lock_timeout_policy: boolean
  camera_disabled: boolean | null
  maximum_time_to_lock_ms: number | null
  desired_camera_disabled: boolean | null
  desired_maximum_time_to_lock_ms: number | null
  battery_level: number | null
'@
        $content = Replace-Once $content $old $new "web Device policy fields"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Dashboard policy controls
    # ------------------------------------------------------------------
    $file = "apps\web\src\pages\DeviceDashboard.tsx"
    $content = Read-Text $file

    if ($content -notmatch "Managed policies") {
        $old = @'
          <section className="device-policy-status">
            <div>
              <p className="eyebrow">
                POLICY STATUS
              </p>
              <h2>Control readiness</h2>
            </div>
'@
        $new = @'
          <section className="device-policy-status">
            <div>
              <p className="eyebrow">
                POLICY STATUS
              </p>
              <h2>Control readiness</h2>
            </div>
'@
        # anchor check only
        if ($content.IndexOf($old) -lt 0) {
            throw "Sprint 07 could not find dashboard policy status section."
        }

        $anchor = @'
          <section className="device-dashboard-panel">
            <div className="device-dashboard-panel-header">
              <div>
                <p className="eyebrow">
                  DEVICE OVERVIEW
'@

        $policyPanel = @'
          <section className="device-policy-management">
            <div>
              <p className="eyebrow">
                MANAGED POLICIES
              </p>
              <h2>Managed policies</h2>
              <p className="device-policy-management-note">
                These controls use Android Device Admin on this test device.
                Changes are queued through the existing Hive command channel.
              </p>
            </div>

            <div className="device-policy-management-grid">
              <article>
                <div>
                  <span>Camera access</span>
                  <strong>
                    {device.camera_disabled === true
                      ? 'Disabled'
                      : device.camera_disabled === false
                        ? 'Enabled'
                        : 'Not reported'}
                  </strong>
                  <small>
                    Desired:{' '}
                    {device.desired_camera_disabled === true
                      ? 'Disabled'
                      : device.desired_camera_disabled === false
                        ? 'Enabled'
                        : 'No policy set'}
                  </small>
                </div>

                <div className="device-policy-buttons">
                  <button
                    className="secondary-button"
                    disabled={
                      sendingCommand !== null ||
                      !device.supports_camera_policy ||
                      device.camera_disabled === false
                    }
                    onClick={() =>
                      void sendCommand(
                        'SET_CAMERA_DISABLED',
                        { disabled: false },
                      ).then(() => {
                        window.setTimeout(() => {
                          void loadDevice()
                        }, 2_000)
                      })
                    }
                    type="button"
                  >
                    Enable camera
                  </button>

                  <button
                    className="secondary-button"
                    disabled={
                      sendingCommand !== null ||
                      !device.supports_camera_policy ||
                      device.camera_disabled === true
                    }
                    onClick={() =>
                      void sendCommand(
                        'SET_CAMERA_DISABLED',
                        { disabled: true },
                      ).then(() => {
                        window.setTimeout(() => {
                          void loadDevice()
                        }, 2_000)
                      })
                    }
                    type="button"
                  >
                    Disable camera
                  </button>
                </div>
              </article>

              <article>
                <div>
                  <span>Screen lock timeout</span>
                  <strong>
                    {device.maximum_time_to_lock_ms == null
                      ? 'Not reported'
                      : device.maximum_time_to_lock_ms === 0
                        ? 'System default'
                        : `${Math.round(
                            device.maximum_time_to_lock_ms / 60_000,
                          )} min`}
                  </strong>
                  <small>
                    Select the maximum idle time before Android locks.
                  </small>
                </div>

                <select
                  aria-label="Screen lock timeout"
                  className="device-policy-select"
                  disabled={
                    sendingCommand !== null ||
                    !device.supports_lock_timeout_policy
                  }
                  onChange={(event) => {
                    const timeoutMs = Number(
                      event.target.value,
                    )

                    void sendCommand(
                      'SET_LOCK_TIMEOUT',
                      { timeout_ms: timeoutMs },
                    ).then(() => {
                      window.setTimeout(() => {
                        void loadDevice()
                      }, 2_000)
                    })
                  }}
                  value={
                    device.desired_maximum_time_to_lock_ms ??
                    device.maximum_time_to_lock_ms ??
                    0
                  }
                >
                  <option value={0}>System default</option>
                  <option value={60000}>1 minute</option>
                  <option value={300000}>5 minutes</option>
                  <option value={900000}>15 minutes</option>
                  <option value={1800000}>30 minutes</option>
                </select>
              </article>
            </div>

            {(!device.supports_camera_policy ||
              !device.supports_lock_timeout_policy) && (
              <p className="device-enterprise-note">
                Activate Device Admin before using managed policy controls.
              </p>
            )}
          </section>

'@

        $content = Replace-Once $content $anchor ($policyPanel + $anchor) "dashboard Device Overview anchor"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Dashboard styles
    # ------------------------------------------------------------------
    $file = "apps\web\src\styles\index.css"
    $content = Read-Text $file

    if ($content -notmatch "Sprint 07 - managed policies") {
        $css = @'

/* Sprint 07 - managed policies */

.device-policy-management {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid #2d2d32;
  border-radius: 14px;
  background: #121214;
}

.device-policy-management h2 {
  margin: 5px 0 0;
}

.device-policy-management-note {
  margin: 7px 0 0;
  color: #8b8b95;
  font-size: 0.74rem;
  line-height: 1.55;
}

.device-policy-management-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.device-policy-management-grid article {
  display: grid;
  gap: 14px;
  padding: 14px;
  border: 1px solid #2a2a2f;
  border-radius: 10px;
  background: #18181b;
}

.device-policy-management-grid span,
.device-policy-management-grid small {
  display: block;
}

.device-policy-management-grid span {
  color: #7f7f8a;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.device-policy-management-grid strong {
  display: block;
  margin-top: 6px;
  font-size: 0.9rem;
}

.device-policy-management-grid small {
  margin-top: 5px;
  color: #8b8b95;
  line-height: 1.5;
}

.device-policy-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.device-policy-select {
  width: 100%;
  min-height: 40px;
  border: 1px solid #34343a;
  border-radius: 9px;
  padding: 8px 10px;
  background: #141416;
  color: #f4f4f5;
  font: inherit;
}

.device-policy-select:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 760px) {
  .device-policy-management-grid {
    grid-template-columns: 1fr;
  }
}
'@
        $content = $content.TrimEnd() + "`r`n" + $css + "`r`n"
        Write-Text $file $content
    }

    # ------------------------------------------------------------------
    # Alembic migration
    # ------------------------------------------------------------------
    $migration = "apps\api\alembic\versions\7c2a91d4e6f8_add_managed_policy_state.py"
    $migrationPath = Join-Path $RepoRoot $migration

    if (-not (Test-Path $migrationPath)) {
        $migrationContent = @'
"""add managed policy state

Revision ID: 7c2a91d4e6f8
Revises: e53b91c4d7a2
Create Date: 2026-08-12
"""

from alembic import op
import sqlalchemy as sa


revision = "7c2a91d4e6f8"
down_revision = "e53b91c4d7a2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE device_command_type "
            "ADD VALUE IF NOT EXISTS 'SET_CAMERA_DISABLED'"
        )
        op.execute(
            "ALTER TYPE device_command_type "
            "ADD VALUE IF NOT EXISTS 'SET_LOCK_TIMEOUT'"
        )

    op.add_column(
        "devices",
        sa.Column(
            "supports_camera_policy",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "supports_lock_timeout_policy",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "devices",
        sa.Column("camera_disabled", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "devices",
        sa.Column(
            "maximum_time_to_lock_ms",
            sa.Integer(),
            nullable=True,
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "desired_camera_disabled",
            sa.Boolean(),
            nullable=True,
        ),
    )
    op.add_column(
        "devices",
        sa.Column(
            "desired_maximum_time_to_lock_ms",
            sa.Integer(),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column(
        "devices",
        "desired_maximum_time_to_lock_ms",
    )
    op.drop_column("devices", "desired_camera_disabled")
    op.drop_column("devices", "maximum_time_to_lock_ms")
    op.drop_column("devices", "camera_disabled")
    op.drop_column(
        "devices",
        "supports_lock_timeout_policy",
    )
    op.drop_column("devices", "supports_camera_policy")

    # PostgreSQL enum values are intentionally retained on downgrade.
'@

        Write-Text $migration $migrationContent
    }

    Write-Host ""
    Write-Host "Running database migration..." -ForegroundColor Cyan
    docker compose exec -T api alembic upgrade head

    if ($LASTEXITCODE -ne 0) {
        throw "Sprint 07 database migration failed."
    }

    Write-Host ""
    Write-Host "Sprint 07 applied." -ForegroundColor Green
    Write-Host ""
    Write-Host "Added:" -ForegroundColor Cyan
    Write-Host "- Managed camera enable/disable policy"
    Write-Host "- Managed screen lock timeout policy"
    Write-Host "- Current policy telemetry"
    Write-Host "- Desired policy state persistence"
    Write-Host "- Capability-aware dashboard policy controls"
    Write-Host "- Existing command history records policy results"
    Write-Host "- No wipe, password reset, factory reset or Device Owner provisioning"
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Cyan

    Assert-Contains `
        "apps\android-agent\app\src\main\res\xml\device_admin_receiver.xml" `
        "<disable-camera\s*/>" `
        "Camera Device Admin policy"

    Assert-Contains `
        "apps\android-agent\app\src\main\res\xml\device_admin_receiver.xml" `
        "<expire-password\s*/>" `
        "Lock timeout Device Admin policy"

    Assert-Contains `
        "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt" `
        "SET_CAMERA_DISABLED" `
        "Camera policy command"

    Assert-Contains `
        "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt" `
        "SET_LOCK_TIMEOUT" `
        "Lock timeout policy command"

    Assert-Contains `
        "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\device\DeviceInfoProvider.kt" `
        "cameraDisabled" `
        "Policy telemetry"

    Assert-Contains `
        "apps\api\src\hive\modules\devices\models.py" `
        "desired_camera_disabled" `
        "Desired policy persistence"

    Assert-Contains `
        "apps\web\src\pages\DeviceDashboard.tsx" `
        "Managed policies" `
        "Managed policy dashboard"

    $commandProcessor = Read-Text `
        "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt"

    if (
        $commandProcessor -match "wipeData\s*\(" -or
        $commandProcessor -match "resetPassword\s*\("
    ) {
        throw "[FAIL] Destructive Device Admin action detected."
    }

    Write-Host "[PASS] No wipe/reset-password execution" -ForegroundColor Green

    Write-Host ""
    Write-Host "[1/3] API compile" -ForegroundColor Cyan
    docker compose exec -T api python -m compileall /app/src/hive

    if ($LASTEXITCODE -ne 0) {
        throw "Sprint 07 API compile failed."
    }

    Write-Host ""
    Write-Host "[2/3] Web production build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\web")

    try {
        npm run build

        if ($LASTEXITCODE -ne 0) {
            throw "Sprint 07 web build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[3/3] Android debug build" -ForegroundColor Cyan
    Push-Location (Join-Path $RepoRoot "apps\android-agent")

    try {
        .\gradlew.bat assembleDebug

        if ($LASTEXITCODE -ne 0) {
            throw "Sprint 07 Android build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "Sprint 07 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual test:" -ForegroundColor Cyan
    Write-Host "1. Install the new debug APK with adb install -r."
    Write-Host "2. Open Hive Agent and confirm Device Admin is still active."
    Write-Host "3. Wait for heartbeat / refresh telemetry."
    Write-Host "4. Dashboard Managed policies should become available."
    Write-Host "5. Disable camera; confirm Android camera is blocked."
    Write-Host "6. Re-enable camera; confirm camera works again."
    Write-Host "7. Set screen lock timeout to 1 minute."
    Write-Host "8. Confirm command completes and dashboard reports the policy."
    Write-Host "9. Return timeout to System default."
    Write-Host ""
    Write-Host "Do not deactivate Device Admin until the camera is enabled and timeout is reset."
}

function Collect-Sprint {
    Write-Host "Sprint 07 context has already been collected." -ForegroundColor Yellow
}

switch ($Mode) {
    "Collect" { Collect-Sprint }
    "Apply" { Apply-Sprint }
    "Validate" { Validate-Sprint }
}