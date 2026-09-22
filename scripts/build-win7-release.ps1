param(
  [Parameter(Mandatory = $true)]
  [string]$RepoPath,

  [string]$ReleaseTag = ""
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Assert-Command([string]$Name, [string]$Help) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found. $Help"
  }
}

Assert-Command "node" "Install Node.js 20.x."
Assert-Command "npm" "Install Node.js 20.x; npm is included."

$RepoPath = (Resolve-Path $RepoPath).Path

foreach ($required in @(
  (Join-Path $RepoPath "package.json"),
  (Join-Path $RepoPath "package-lock.json"),
  (Join-Path $RepoPath "electron-builder.win7.cjs"),
  (Join-Path $RepoPath "electron\main.cjs"),
  (Join-Path $RepoPath "public\icons\app-icon-desktop-512.png")
)) {
  if (-not (Test-Path $required)) {
    throw "Required build file not found: $required"
  }
}

Push-Location $RepoPath

try {
  Write-Host ""
  Write-Host "Installing PWA dependencies..."
  npm ci
  if ($LASTEXITCODE -ne 0) {
    throw "npm ci failed."
  }

  Write-Host ""
  Write-Host "Installing pinned Windows 7 desktop build tools..."
  npm install --no-save --no-package-lock `
    electron@22.3.27 `
    electron-builder@24.13.3 `
    rcedit@5.0.2

  if ($LASTEXITCODE -ne 0) {
    throw "Installing Electron build dependencies failed."
  }

  Write-Host ""
  Write-Host "Building desktop web assets..."
  $env:VITE_BASE_PATH = "./"

  npx tsc
  if ($LASTEXITCODE -ne 0) {
    throw "TypeScript build failed."
  }

  npx vite build
  if ($LASTEXITCODE -ne 0) {
    throw "Vite build failed."
  }

  $releaseRoot = Join-Path $RepoPath "release-win7"
  $zipDir = Join-Path $releaseRoot "zips"

  if (Test-Path $releaseRoot) {
    Remove-Item -Recurse -Force $releaseRoot
  }

  New-Item -ItemType Directory -Force -Path $zipDir | Out-Null
  New-Item -ItemType Directory -Force -Path (Join-Path $releaseRoot "build") | Out-Null

  $env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

  # Generate a real multi-size .ico from the desktop-specific PWA artwork.
  $iconPng = Join-Path $RepoPath "public\icons\app-icon-desktop-512.png"
  $iconIco = Join-Path $releaseRoot "build\khmer-calendar.ico"

  & (Join-Path $RepoPath "scripts\make-win-icon.ps1") `
    -SourcePng $iconPng `
    -DestinationIco $iconIco

  if ($LASTEXITCODE -ne 0) {
    throw "Generating the Windows icon failed."
  }

  $commit = ""
  if (Get-Command git -ErrorAction SilentlyContinue) {
    $commit = (& git rev-parse HEAD 2>$null)
  }

  $portableReadme = @"
Khmer Calendar - Windows 7 Portable
===================================

Release: $ReleaseTag
Source commit: $commit
Electron: 22.3.27

1. Extract the ENTIRE ZIP to a normal folder.
2. Run "Khmer Calendar.exe".
3. Do not copy only the EXE; Electron needs the files beside it.
4. Personal settings/events are stored in "KhmerCalendarData" beside the EXE.
5. The application is designed to run offline.

This build is intentionally unsigned and uses the final Electron generation
that supports Windows 7.
"@

  foreach ($arch in @("x64", "ia32")) {
    Write-Host ""
    Write-Host "Packaging Windows 7 $arch..."

    $outDir = Join-Path $releaseRoot $arch

    & npx electron-builder `
      --config electron-builder.win7.cjs `
      --win dir `
      ("--" + $arch) `
      ("--config.directories.output=" + $outDir)

    if ($LASTEXITCODE -ne 0) {
      throw "electron-builder failed for $arch."
    }

    $unpacked = Get-ChildItem -Path $outDir -Directory |
      Where-Object { $_.Name -like "win*unpacked" } |
      Select-Object -First 1

    if (-not $unpacked) {
      throw "No win*-unpacked output directory was found for $arch."
    }

    $exePath = Join-Path $unpacked.FullName "Khmer Calendar.exe"
    if (-not (Test-Path $exePath)) {
      throw "Packaged executable was not found: $exePath"
    }

    # electron-builder EXE resource editing stays disabled because its
    # winCodeSign helper can fail to extract symlinks on Windows hosts.
    # Patch the finished executable separately with standalone rcedit.
    Write-Host "Applying Khmer Calendar icon and Windows metadata..."
    node scripts/patch-win-exe.mjs $exePath $iconIco
    if ($LASTEXITCODE -ne 0) {
      throw "Applying the Windows app icon failed for $arch."
    }

    [System.IO.File]::WriteAllText(
      (Join-Path $unpacked.FullName "README-WINDOWS7.txt"),
      $portableReadme,
      (New-Object System.Text.UTF8Encoding($false))
    )

    $destinationZip = Join-Path $zipDir ("Khmer-Calendar-Win7-" + $arch + ".zip")

    if (Test-Path $destinationZip) {
      Remove-Item -Force $destinationZip
    }

    Compress-Archive `
      -Path (Join-Path $unpacked.FullName "*") `
      -DestinationPath $destinationZip `
      -CompressionLevel Optimal

    Write-Host "Created:"
    Write-Host "  $destinationZip"
  }

  # Checksums are useful for release downloads and archival.
  $checksumFile = Join-Path $zipDir "SHA256SUMS.txt"
  $checksumLines = Get-ChildItem -Path $zipDir -Filter "*.zip" |
    Sort-Object Name |
    ForEach-Object {
      $hash = (Get-FileHash -Algorithm SHA256 $_.FullName).Hash.ToLowerInvariant()
      "$hash  $($_.Name)"
    }

  [System.IO.File]::WriteAllLines(
    $checksumFile,
    $checksumLines,
    (New-Object System.Text.UTF8Encoding($false))
  )

  Write-Host ""
  Write-Host "Windows 7 release assets are ready:"
  Get-ChildItem -Path $zipDir | ForEach-Object {
    Write-Host ("  " + $_.FullName)
  }
}
finally {
  Pop-Location
}
