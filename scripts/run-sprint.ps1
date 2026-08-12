param(
    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 99)]
    [int]$Sprint,

    [ValidateSet("Collect", "Apply", "Validate")]
    [string]$Mode = "Collect"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$scriptName = "sprint-{0:D2}-*" -f $Sprint
$upgradeDir = Join-Path $PSScriptRoot "upgrades"

$matching = Get-ChildItem -Path $upgradeDir -Filter "$scriptName.ps1" -File

if (-not $matching) {
    throw "No sprint script found for Sprint $Sprint in $upgradeDir"
}

if ($matching.Count -gt 1) {
    throw "More than one sprint script matched Sprint $Sprint. Keep one script per sprint."
}

$scriptPath = $matching.FullName

Write-Host ""
Write-Host "Hive Sprint Runner" -ForegroundColor Yellow
Write-Host "Repository : $repoRoot"
Write-Host "Sprint     : $Sprint"
Write-Host "Mode       : $Mode"
Write-Host "Script     : $scriptPath"
Write-Host ""

Push-Location $repoRoot
try {
    & $scriptPath -Mode $Mode
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
