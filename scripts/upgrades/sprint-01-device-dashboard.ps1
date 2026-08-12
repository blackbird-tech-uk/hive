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

$ExpectedFiles = @(
    "apps\web\src\pages\DeviceDashboard.tsx",
    "apps\web\src\styles\index.css",
    "apps\web\src\lib\api\commands.ts",
    "apps\web\src\lib\api\devices.ts",
    "apps\web\src\lib\api\types.ts",
    "apps\web\src\components\devices\EnrollmentModal.tsx",
    "docker-compose.yml"
)

function Write-Section {
    param([string]$Title)
    Add-Content -Path $ContextFile -Value ""
    Add-Content -Path $ContextFile -Value ("=" * 90)
    Add-Content -Path $ContextFile -Value $Title
    Add-Content -Path $ContextFile -Value ("=" * 90)
}

function Assert-GitRepository {
    git rev-parse --is-inside-work-tree *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "Run this script from the Hive Git repository."
    }
}

function Assert-CleanWorkingTree {
    $status = git status --porcelain
    if ($status) {
        throw "Working tree is not clean. Commit or stash changes before Apply mode."
    }
}

function Backup-ExpectedFiles {
    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

    foreach ($relativePath in $ExpectedFiles) {
        $source = Join-Path $RepoRoot $relativePath

        if (-not (Test-Path $source)) {
            continue
        }

        $destination = Join-Path $BackupDir $relativePath
        $destinationDir = Split-Path $destination -Parent

        New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
        Copy-Item -Path $source -Destination $destination -Force
    }
}

function Collect-SprintContext {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

    @"
$SprintName
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Sprint scope:
- Fix and standardise Quick Actions
- Make Message a working modal/composer
- Add Refresh Apps action entry point
- Improve command queued/sent/acknowledged/completed/failed UX
- Polish device telemetry presentation
- Improve loading/error states
- Confirm Docker serves the latest frontend build
- Keep existing working functionality intact
"@ | Set-Content -Path $ContextFile

    Write-Section "GIT STATUS"
    git status | Out-String | Add-Content -Path $ContextFile

    Write-Section "CURRENT BRANCH"
    git branch --show-current | Out-String | Add-Content -Path $ContextFile

    Write-Section "RECENT COMMITS"
    git log --oneline -10 | Out-String | Add-Content -Path $ContextFile

    Write-Section "WEB SOURCE TREE"
    if (Test-Path (Join-Path $RepoRoot "apps\web\src")) {
        Get-ChildItem (Join-Path $RepoRoot "apps\web\src") -Recurse -File |
            Select-Object -ExpandProperty FullName |
            Out-String |
            Add-Content -Path $ContextFile
    }

    foreach ($relativePath in $ExpectedFiles) {
        $fullPath = Join-Path $RepoRoot $relativePath
        Write-Section "FILE: $relativePath"

        if (Test-Path $fullPath) {
            Get-Content $fullPath -Raw | Add-Content -Path $ContextFile
        }
        else {
            Add-Content -Path $ContextFile -Value "[MISSING]"
        }
    }

    Write-Section "DEVICE DASHBOARD REFERENCES"
    $webSrc = Join-Path $RepoRoot "apps\web\src"
    if (Test-Path $webSrc) {
        Get-ChildItem $webSrc -Recurse -File -Include *.ts,*.tsx |
            Select-String -Pattern "PING|RING|SHOW_MESSAGE|REQUEST_LOCATION|REFRESH_APPS|device-dashboard-action|Quick actions" |
            ForEach-Object { $_.ToString() } |
            Add-Content -Path $ContextFile
    }

    Write-Host ""
    Write-Host "Sprint 01 context collected." -ForegroundColor Green
    Write-Host "File: $ContextFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Upload that context file to ChatGPT so the Apply script can be generated against the real codebase."
}

function Apply-Sprint {
    Assert-CleanWorkingTree
    Backup-ExpectedFiles

    throw @"
Sprint 01 Apply mode is intentionally locked until the generated context file has been reviewed.
Run:
  .\scripts\run-sprint.ps1 -Sprint 1 -Mode Collect

Then upload:
  $ContextFile

After the upgrade logic is generated, replace this Apply-Sprint body with the approved mass-upgrade operations.
"@
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Validating $SprintName" -ForegroundColor Yellow

    Write-Host ""
    Write-Host "[1/4] Git diff" -ForegroundColor Cyan
    git diff --stat

    Write-Host ""
    Write-Host "[2/4] Web build" -ForegroundColor Cyan
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
    Write-Host "[3/4] API import smoke test" -ForegroundColor Cyan
    docker compose exec api python -c "from hive.main import app; print('Hive API import OK')"
    if ($LASTEXITCODE -ne 0) {
        throw "API smoke test failed."
    }

    Write-Host ""
    Write-Host "[4/4] Docker status" -ForegroundColor Cyan
    docker compose ps

    Write-Host ""
    Write-Host "Sprint 01 validation passed." -ForegroundColor Green
}

Assert-GitRepository

switch ($Mode) {
    "Collect"  { Collect-SprintContext }
    "Apply"    { Apply-Sprint }
    "Validate" { Validate-Sprint }
}
