param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath,

  [string]$KitPath = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$RepoPath = (Resolve-Path $RepoPath).Path
$KitPath = (Resolve-Path $KitPath).Path

$packageJson = Join-Path $RepoPath "package.json"
$mainTs = Join-Path $RepoPath "src\main.ts"
$desktopIcon = Join-Path $RepoPath "public\icons\app-icon-desktop-512.png"

foreach ($required in @($packageJson, $mainTs, $desktopIcon)) {
  if (-not (Test-Path $required)) {
    throw "Required upstream file not found: $required"
  }
}

Write-Host "Applying Windows 7 compatibility kit to:"
Write-Host "  $RepoPath"
Write-Host "From kit:"
Write-Host "  $KitPath"
Write-Host ""

# Copy only the files required by the desktop build.
$electronDir = Join-Path $RepoPath "electron"
New-Item -ItemType Directory -Force -Path $electronDir | Out-Null

foreach ($name in @("main.cjs", "desktop-overrides.css", "legacy-watermark.js")) {
  Copy-Item -Force `
    (Join-Path $KitPath ("electron\" + $name)) `
    (Join-Path $electronDir $name)
}

Copy-Item -Force `
  (Join-Path $KitPath "electron-builder.win7.cjs") `
  (Join-Path $RepoPath "electron-builder.win7.cjs")

$scriptsDir = Join-Path $RepoPath "scripts"
New-Item -ItemType Directory -Force -Path $scriptsDir | Out-Null

foreach ($name in @(
  "build-win7-release.ps1",
  "make-win-icon.ps1",
  "patch-win-exe.mjs"
)) {
  Copy-Item -Force `
    (Join-Path $KitPath ("scripts\" + $name)) `
    (Join-Path $scriptsDir $name)
}

# Service workers are for the web/PWA origin. Do not start AppUpdater's service
# worker path when the same app is hosted under the Electron custom protocol.
#
# Keep the patch deliberately tiny and fail loudly if upstream changes the
# expected expression. This prevents a release from silently building with an
# unreviewed guess.
$content = Get-Content -Raw -Encoding UTF8 $mainTs

$original = "import.meta.env.PROD && 'serviceWorker' in navigator"
$patched = "import.meta.env.PROD && (location.protocol === 'https:' || location.protocol === 'http:') && 'serviceWorker' in navigator"

if ($content.Contains($patched)) {
  Write-Host "src\main.ts service-worker guard is already patched."
}
else {
  $matches = [regex]::Matches($content, [regex]::Escape($original))

  if ($matches.Count -ne 1) {
    throw @"
Could not safely patch src\main.ts.

Expected exactly one occurrence of:
  $original

Found:
  $($matches.Count)

The upstream PWA source probably changed. Update scripts\apply-win7.ps1 on the
win7-portable branch instead of guessing during a release build.
"@
  }

  $content = $content.Replace($original, $patched)
  [System.IO.File]::WriteAllText(
    $mainTs,
    $content,
    (New-Object System.Text.UTF8Encoding($false))
  )

  Write-Host "Patched src\main.ts service-worker guard."
}

Write-Host ""
Write-Host "Windows 7 compatibility files applied successfully."
