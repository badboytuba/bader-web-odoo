param(
    [Parameter(Mandatory = $true)]
    [string]$Url,
    [string]$Slug = "pdp",
    [string]$OutputDir = ".qa-artifacts/pdp-screenshots",
    [int]$VirtualTimeBudget = 12000
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$browserCandidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
)

$browserPath = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browserPath) {
    throw "No local Chrome/Edge executable was found."
}

$resolvedOutputDir = Join-Path $root $OutputDir
New-Item -ItemType Directory -Force -Path $resolvedOutputDir | Out-Null

$targets = @(
    @{ Name = "desktop"; Size = "1440,1800" },
    @{ Name = "mobile"; Size = "430,1400" }
)

$createdFiles = @()

foreach ($target in $targets) {
    $outputPath = Join-Path $resolvedOutputDir ("{0}-{1}.png" -f $Slug, $target.Name)
    $arguments = @(
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        "--window-size=$($target.Size)",
        "--virtual-time-budget=$VirtualTimeBudget",
        "--screenshot=$outputPath",
        $Url
    )

    & $browserPath @arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Screenshot capture failed for $($target.Name) with exit code $LASTEXITCODE."
    }

    $createdFiles += $outputPath
}

$meta = [ordered]@{
    url = $Url
    browser = $browserPath
    files = $createdFiles
}

$metaPath = Join-Path $resolvedOutputDir ("{0}-meta.json" -f $Slug)
$meta | ConvertTo-Json -Depth 3 | Set-Content -Path $metaPath -Encoding utf8
$meta | ConvertTo-Json -Depth 3
