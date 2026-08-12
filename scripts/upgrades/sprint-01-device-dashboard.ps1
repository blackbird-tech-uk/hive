param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Collect"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 01 - Device Dashboard & UX"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$OutputDir = Join-Path $RepoRoot ".hive-sprint"
$ContextFile = Join-Path $OutputDir "sprint-01-context.txt"
$BackupDir = Join-Path $OutputDir "backups\sprint-01"

$DashboardPath = Join-Path $RepoRoot "apps\web\src\pages\DeviceDashboard.tsx"
$StylesPath = Join-Path $RepoRoot "apps\web\src\styles\index.css"
$ThisScriptRelativePath = "scripts/upgrades/sprint-01-device-dashboard.ps1"

function Assert-GitRepository {
    git rev-parse --is-inside-work-tree *> $null

    if ($LASTEXITCODE -ne 0) {
        throw "Run this script from the Hive Git repository."
    }
}

function Assert-SafeWorkingTree {
    $changes = @(
        git status --porcelain |
            Where-Object {
                $_ -and
                $_.Substring(3).Replace("\", "/") -ne $ThisScriptRelativePath
            }
    )

    if ($changes.Count -gt 0) {
        Write-Host ""
        Write-Host "Unexpected working-tree changes:" -ForegroundColor Red
        $changes | ForEach-Object { Write-Host $_ }

        throw "Commit or stash unrelated changes before running Sprint 01 Apply."
    }
}

function Backup-File {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $repoUri = New-Object System.Uri(
        ($RepoRoot.TrimEnd('\') + '\')
    )

    $fileUri = New-Object System.Uri(
        $Path
    )

    $relativePath = [System.Uri]::UnescapeDataString(
        $repoUri.MakeRelativeUri(
            $fileUri
        ).ToString()
    ).Replace('/', '\')

    $destination = Join-Path `
        $BackupDir `
        $relativePath

    $destinationDirectory =
        Split-Path $destination -Parent

    New-Item `
        -ItemType Directory `
        -Path $destinationDirectory `
        -Force |
        Out-Null

    Copy-Item `
        -Path $Path `
        -Destination $destination `
        -Force
}

function Replace-Exact {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Content,

        [Parameter(Mandatory = $true)]
        [string]$Old,

        [Parameter(Mandatory = $true)]
        [string]$New,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if (-not $Content.Contains($Old)) {
        throw "Sprint 01 could not find expected block: $Label. No changes were written."
    }

    return $Content.Replace($Old, $New)
}

function Collect-SprintContext {
    New-Item `
        -ItemType Directory `
        -Path $OutputDir `
        -Force |
        Out-Null

    @"
$SprintName

Sprint 01 Apply is ready.

Targets:
- DeviceDashboard.tsx
- index.css

Features:
- Enable Message quick action
- Add Message composer modal
- Queue SHOW_MESSAGE with title/message payload
- Add Refresh Apps quick action
- Queue REFRESH_APPS for Sprint 02 inventory processing
- Expand action grid from five to six desktop actions
- Preserve existing Ping, Ring, Locate and telemetry refresh behavior
- Keep existing command polling/status history
"@ | Set-Content -Path $ContextFile -Encoding UTF8

    Write-Host ""
    Write-Host "Sprint 01 context refreshed." -ForegroundColor Green
    Write-Host "File: $ContextFile" -ForegroundColor Cyan
}

function Apply-Sprint {
    Assert-SafeWorkingTree

    if (-not (Test-Path $DashboardPath)) {
        throw "DeviceDashboard.tsx was not found at $DashboardPath"
    }

    if (-not (Test-Path $StylesPath)) {
        throw "index.css was not found at $StylesPath"
    }

    Remove-Item `
        -Path $BackupDir `
        -Recurse `
        -Force `
        -ErrorAction SilentlyContinue

    Backup-File -Path $DashboardPath
    Backup-File -Path $StylesPath

    $dashboard = (
        Get-Content $DashboardPath -Raw
    ).Replace("`r`n", "`n")

    $styles = (
        Get-Content $StylesPath -Raw
    ).Replace("`r`n", "`n")

    # ---------------------------------------------------------
    # 1. Message composer state
    # ---------------------------------------------------------

    $oldState = @'
  const [commandError, setCommandError] =
    useState<string | null>(null)

  const [commands, setCommands] =
'@

    $newState = @'
  const [commandError, setCommandError] =
    useState<string | null>(null)

  const [messageComposerOpen, setMessageComposerOpen] =
    useState(false)

  const [messageTitle, setMessageTitle] =
    useState('Hive message')

  const [messageBody, setMessageBody] =
    useState('')

  const [commands, setCommands] =
'@

    $dashboard = Replace-Exact `
        -Content $dashboard `
        -Old $oldState `
        -New $newState `
        -Label "message composer state"

    # ---------------------------------------------------------
    # 2. Message and app-refresh handlers
    # ---------------------------------------------------------

    $handlerAnchor = @'
useEffect(() => {
  void loadDevice()
'@

    $handlers = @'
  const handleSendMessage = useCallback(
    async () => {
      const cleanMessage = messageBody.trim()

      if (!cleanMessage) {
        setCommandNotice(null)
        setCommandError(
          'Enter a message before sending.',
        )
        return
      }

      await sendCommand(
        'SHOW_MESSAGE',
        {
          title:
            messageTitle.trim() ||
            'Hive message',
          message: cleanMessage,
        },
      )

      setMessageComposerOpen(false)
      setMessageBody('')
    },
    [
      messageBody,
      messageTitle,
      sendCommand,
    ],
  )

  const handleRefreshApps = useCallback(
    async () => {
      await sendCommand('REFRESH_APPS')
    },
    [sendCommand],
  )

useEffect(() => {
  void loadDevice()
'@

    $dashboard = Replace-Exact `
        -Content $dashboard `
        -Old $handlerAnchor `
        -New $handlers `
        -Label "message and refresh-app handlers"

    # ---------------------------------------------------------
    # 3. Enable Message button
    # ---------------------------------------------------------

    $oldMessageButton = @'
          <button
            className="device-dashboard-action"
            disabled
            title="Message composer will be added next"
            type="button"
          >
            <MessageSquare
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>Message</strong>

              <small>
                Display a device message
              </small>
            </span>
          </button>
'@

    $newMessageButton = @'
          <button
            className="device-dashboard-action"
            disabled={sendingCommand !== null}
            onClick={() => {
              setCommandError(null)
              setCommandNotice(null)
              setMessageComposerOpen(true)
            }}
            type="button"
          >
            <MessageSquare
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'SHOW_MESSAGE'
                  ? 'Queuing...'
                  : 'Message'}
              </strong>

              <small>
                Display a device message
              </small>
            </span>
          </button>
'@

    $dashboard = Replace-Exact `
        -Content $dashboard `
        -Old $oldMessageButton `
        -New $newMessageButton `
        -Label "Message quick action"

    # ---------------------------------------------------------
    # 4. Add Refresh Apps before telemetry refresh
    # ---------------------------------------------------------

    $oldRefreshButton = @'
          <button
            className="device-dashboard-action"
            disabled={loading}
            onClick={() =>
              void loadDevice()
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>Refresh</strong>

              <small>
                Reload device telemetry
              </small>
            </span>
          </button>
'@

    $newRefreshButtons = @'
          <button
            className="device-dashboard-action"
            disabled={sendingCommand !== null}
            onClick={() =>
              void handleRefreshApps()
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>
                {sendingCommand === 'REFRESH_APPS'
                  ? 'Queuing...'
                  : 'Refresh apps'}
              </strong>

              <small>
                Request installed app inventory
              </small>
            </span>
          </button>

          <button
            className="device-dashboard-action"
            disabled={loading}
            onClick={() =>
              void loadDevice()
            }
            type="button"
          >
            <RefreshCw
              aria-hidden="true"
              size={20}
            />

            <span>
              <strong>Refresh telemetry</strong>

              <small>
                Reload device telemetry
              </small>
            </span>
          </button>
'@

    $dashboard = Replace-Exact `
        -Content $dashboard `
        -Old $oldRefreshButton `
        -New $newRefreshButtons `
        -Label "Refresh Apps quick action"

    # ---------------------------------------------------------
    # 5. Insert message composer modal
    # ---------------------------------------------------------

    $summaryAnchor = @'
      <section
        aria-label="Device summary"
        className="device-dashboard-summary"
      >
'@

    $modalAndSummary = @'
      {messageComposerOpen && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMessageComposerOpen(false)
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="device-message-title"
            aria-modal="true"
            className="modal"
            role="dialog"
          >
            <header className="modal-header">
              <div>
                <p className="eyebrow">
                  REMOTE MESSAGE
                </p>

                <h2 id="device-message-title">
                  Send message to device
                </h2>
              </div>

              <button
                aria-label="Close message composer"
                className="modal-close-button"
                disabled={
                  sendingCommand ===
                  'SHOW_MESSAGE'
                }
                onClick={() =>
                  setMessageComposerOpen(false)
                }
                type="button"
              >
                ×
              </button>
            </header>

            <div className="event-form">
              <label>
                Title

                <input
                  disabled={
                    sendingCommand ===
                    'SHOW_MESSAGE'
                  }
                  maxLength={120}
                  onChange={(event) =>
                    setMessageTitle(
                      event.target.value,
                    )
                  }
                  placeholder="Hive message"
                  type="text"
                  value={messageTitle}
                />
              </label>

              <label>
                Message

                <textarea
                  autoFocus
                  disabled={
                    sendingCommand ===
                    'SHOW_MESSAGE'
                  }
                  maxLength={1000}
                  onChange={(event) =>
                    setMessageBody(
                      event.target.value,
                    )
                  }
                  placeholder="Enter the message to display on the device..."
                  rows={5}
                  value={messageBody}
                />
              </label>
            </div>

            <footer className="modal-actions">
              <button
                className="secondary-button"
                disabled={
                  sendingCommand ===
                  'SHOW_MESSAGE'
                }
                onClick={() =>
                  setMessageComposerOpen(false)
                }
                type="button"
              >
                Cancel
              </button>

              <button
                className="primary-button"
                disabled={
                  sendingCommand !== null ||
                  !messageBody.trim()
                }
                onClick={() =>
                  void handleSendMessage()
                }
                type="button"
              >
                {sendingCommand ===
                'SHOW_MESSAGE'
                  ? 'Sending...'
                  : 'Send message'}
              </button>
            </footer>
          </section>
        </div>
      )}

      <section
        aria-label="Device summary"
        className="device-dashboard-summary"
      >
'@

    $dashboard = Replace-Exact `
        -Content $dashboard `
        -Old $summaryAnchor `
        -New $modalAndSummary `
        -Label "message composer modal"

    # ---------------------------------------------------------
    # 6. Six-column desktop action grid
    # ---------------------------------------------------------

    $oldGrid = @'
.device-dashboard-action-grid {
  display: grid;
  grid-template-columns:
    repeat(5, minmax(0, 1fr));
  gap: 10px;
}
'@

    $newGrid = @'
.device-dashboard-action-grid {
  display: grid;
  grid-template-columns:
    repeat(6, minmax(0, 1fr));
  gap: 10px;
}
'@

    $styles = Replace-Exact `
        -Content $styles `
        -Old $oldGrid `
        -New $newGrid `
        -Label "six-column quick-action grid"

    Set-Content `
        -Path $DashboardPath `
        -Value $dashboard `
        -Encoding UTF8

    Set-Content `
        -Path $StylesPath `
        -Value $styles `
        -Encoding UTF8

    Write-Host ""
    Write-Host "Sprint 01 Apply completed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Changed:" -ForegroundColor Cyan
    Write-Host "  - Enabled Message quick action"
    Write-Host "  - Added remote message composer"
    Write-Host "  - Added Refresh Apps quick action"
    Write-Host "  - Expanded desktop quick-action grid"
    Write-Host ""
    Write-Host "Next run:" -ForegroundColor Yellow
    Write-Host "  .\scripts\run-sprint.ps1 -Sprint 1 -Mode Validate"
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "[1/5] Git diff" -ForegroundColor Cyan
    git diff --stat

    Write-Host ""
    Write-Host "[2/5] TypeScript production build" -ForegroundColor Cyan

    Push-Location (Join-Path $RepoRoot "apps\web")
    try {
        npm run build

        if ($LASTEXITCODE -ne 0) {
            throw "Web production build failed."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "[3/5] API import smoke test" -ForegroundColor Cyan

    docker compose exec api python -c "from hive.main import app; print('Hive API import OK')"

    if ($LASTEXITCODE -ne 0) {
        throw "API smoke test failed."
    }

    Write-Host ""
    Write-Host "[4/5] Docker services" -ForegroundColor Cyan
    docker compose ps

    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose status check failed."
    }

    Write-Host ""
    Write-Host "[5/5] Sprint assertions" -ForegroundColor Cyan

    $dashboard = Get-Content $DashboardPath -Raw

    $requiredMarkers = @(
        "SHOW_MESSAGE",
        "REFRESH_APPS",
        "Send message to device",
        "Refresh apps",
        "Refresh telemetry"
    )

    foreach ($marker in $requiredMarkers) {
        if (-not $dashboard.Contains($marker)) {
            throw "Validation failed: missing '$marker' in DeviceDashboard.tsx"
        }
    }

    Write-Host ""
    Write-Host "Sprint 01 validation passed." -ForegroundColor Green
    Write-Host ""
    Write-Host "Manual checks:" -ForegroundColor Yellow
    Write-Host "  1. Open a device dashboard."
    Write-Host "  2. Test Ping."
    Write-Host "  3. Test Ring."
    Write-Host "  4. Test Locate."
    Write-Host "  5. Open Message and send a test notification."
    Write-Host "  6. Queue Refresh Apps (agent processing lands in Sprint 02)."
    Write-Host "  7. Refresh telemetry."
    Write-Host "  8. Confirm Activity updates command statuses."
}

Assert-GitRepository

switch ($Mode) {
    "Collect" {
        Collect-SprintContext
    }

    "Apply" {
        Apply-Sprint
    }

    "Validate" {
        Validate-Sprint
    }
}
