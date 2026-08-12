param(
    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Collect"
)

$ErrorActionPreference = "Stop"

$SprintName = "Sprint 02 - Installed Apps Inventory"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$OutputDir = Join-Path $RepoRoot ".hive-sprint"
$ContextFile = Join-Path $OutputDir "sprint-02-context.txt"

$ExpectedFiles = @(
    "apps\api\src\hive\modules\inventory\__init__.py",
    "apps\api\src\hive\modules\inventory\models.py",
    "apps\api\src\hive\modules\inventory\schemas.py",
    "apps\api\src\hive\modules\inventory\repository.py",
    "apps\api\src\hive\modules\inventory\service.py",
    "apps\api\src\hive\modules\inventory\router.py",
    "apps\api\src\hive\api\v1\router.py",
    "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\Models.kt",
    "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\api\HiveApiClient.kt",
    "apps\android-agent\app\src\main\java\com\blackbird\hiveagent\commands\CommandProcessor.kt",
    "apps\web\src\pages\DeviceDashboard.tsx",
    "apps\web\src\lib\api\index.ts",
    "apps\web\src\lib\api\types.ts",
    "apps\web\src\styles\index.css"
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

function Collect-SprintContext {
    New-Item `
        -ItemType Directory `
        -Path $OutputDir `
        -Force |
        Out-Null

    @"
$SprintName
Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

Sprint scope:
- Complete installed application inventory backend
- Add Android installed-app scanner
- Implement REFRESH_APPS command
- Upload inventory from Android agent
- Add device Applications tab
- Show package, version and system/user app state
- Show app count and refresh status
- Preserve existing command delivery and dashboard functionality
- Validate API, web and Android builds
"@ | Set-Content -Path $ContextFile -Encoding UTF8

    Write-Section "GIT STATUS"
    git status | Out-String | Add-Content -Path $ContextFile

    Write-Section "CURRENT BRANCH"
    git branch --show-current | Out-String | Add-Content -Path $ContextFile

    Write-Section "RECENT COMMITS"
    git log --oneline -12 | Out-String | Add-Content -Path $ContextFile

    Write-Section "INVENTORY MODULE TREE"
    $inventoryDir = Join-Path $RepoRoot "apps\api\src\hive\modules\inventory"

    if (Test-Path $inventoryDir) {
        Get-ChildItem $inventoryDir -Recurse -File |
            Select-Object -ExpandProperty FullName |
            Out-String |
            Add-Content -Path $ContextFile
    }

    foreach ($relativePath in $ExpectedFiles) {
        $fullPath = Join-Path $RepoRoot $relativePath

        Write-Section "FILE: $relativePath"

        if (Test-Path $fullPath) {
            Get-Content $fullPath -Raw |
                Add-Content -Path $ContextFile
        }
        else {
            Add-Content -Path $ContextFile -Value "[MISSING]"
        }
    }

    Write-Section "INVENTORY / APP REFERENCES"

    $searchRoots = @(
        (Join-Path $RepoRoot "apps\api\src"),
        (Join-Path $RepoRoot "apps\android-agent\app\src\main\java"),
        (Join-Path $RepoRoot "apps\web\src")
    )

    foreach ($root in $searchRoots) {
        if (-not (Test-Path $root)) {
            continue
        }

        Get-ChildItem `
            $root `
            -Recurse `
            -File `
            -Include *.py,*.kt,*.ts,*.tsx |
            Select-String `
                -Pattern "InstalledApplication|installed_apps|installed applications|REFRESH_APPS|PackageManager|inventory" |
            ForEach-Object {
                $_.ToString()
            } |
            Add-Content -Path $ContextFile
    }

    Write-Section "ALEMBIC MIGRATIONS"

    $versionsDir = Join-Path $RepoRoot "apps\api\alembic\versions"

    if (Test-Path $versionsDir) {
        Get-ChildItem $versionsDir -File |
            Sort-Object LastWriteTime |
            Select-Object FullName, LastWriteTime |
            Out-String |
            Add-Content -Path $ContextFile
    }

    Write-Host ""
    Write-Host "Sprint 02 context collected." -ForegroundColor Green
    Write-Host "File: $ContextFile" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Upload sprint-02-context.txt to ChatGPT."
}

function Apply-Sprint {
    throw @"
Sprint 02 Apply mode is intentionally locked until the collected
context has been reviewed.

Run:
  .\scripts\run-sprint.ps1 -Sprint 2 -Mode Collect

Then upload:
  $ContextFile
"@
}

function Validate-Sprint {
    Write-Host ""
    Write-Host "Sprint 02 validation is not enabled until Apply is generated." -ForegroundColor Yellow
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
