param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePng,

  [Parameter(Mandatory = $true)]
  [string]$DestinationIco
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$SourcePng = [System.IO.Path]::GetFullPath($SourcePng)
$DestinationIco = [System.IO.Path]::GetFullPath($DestinationIco)

if (-not (Test-Path $SourcePng)) {
  throw "Icon source PNG was not found: $SourcePng"
}

$destDir = Split-Path -Parent $DestinationIco
New-Item -ItemType Directory -Force -Path $destDir | Out-Null

# Include the common sizes Windows Explorer/taskbar may request.
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$pngData = @()

$source = [System.Drawing.Image]::FromFile($SourcePng)

try {
  foreach ($size in $sizes) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size,
      ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $size, $size)
      }
      finally {
        $graphics.Dispose()
      }

      $stream = New-Object System.IO.MemoryStream

      try {
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngData += ,$stream.ToArray()
      }
      finally {
        $stream.Dispose()
      }
    }
    finally {
      $bitmap.Dispose()
    }
  }
}
finally {
  $source.Dispose()
}

# ICO format: ICONDIR + one ICONDIRENTRY per PNG + PNG payloads.
$file = [System.IO.File]::Create($DestinationIco)
$writer = New-Object System.IO.BinaryWriter $file

try {
  $writer.Write([UInt16]0)                 # reserved
  $writer.Write([UInt16]1)                 # type: icon
  $writer.Write([UInt16]$sizes.Count)

  $offset = 6 + (16 * $sizes.Count)

  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $bytes = $pngData[$i]

    $wh = if ($size -eq 256) { [byte]0 } else { [byte]$size }

    $writer.Write($wh)                     # width (0 means 256)
    $writer.Write($wh)                     # height
    $writer.Write([byte]0)                 # palette colors
    $writer.Write([byte]0)                 # reserved
    $writer.Write([UInt16]1)               # color planes
    $writer.Write([UInt16]32)              # bits per pixel
    $writer.Write([UInt32]$bytes.Length)   # image byte size
    $writer.Write([UInt32]$offset)         # image offset

    $offset += $bytes.Length
  }

  foreach ($bytes in $pngData) {
    $writer.Write($bytes)
  }
}
finally {
  $writer.Dispose()
  $file.Dispose()
}

Write-Host "Created Windows icon:"
Write-Host "  $DestinationIco"
