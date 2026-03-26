param(
  [Parameter(Mandatory = $true)]
  [string]$RequestPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

function Await-Async {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Operation,

    [Parameter(Mandatory = $true)]
    [type]$ResultType
  )

  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethod -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } |
    Select-Object -First 1

  if (-not $method) {
    throw 'Unable to resolve WinRT AsTask helper.'
  }

  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  return $task.GetAwaiter().GetResult()
}

function Get-WindowsType {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TypeName,

    [Parameter(Mandatory = $true)]
    [string]$AssemblyName
  )

  return [type]::GetType("$TypeName,$AssemblyName,ContentType=WindowsRuntime")
}

function New-OcrEngine {
  param(
    [string]$LanguageTag
  )

  $ocrEngineType = Get-WindowsType 'Windows.Media.Ocr.OcrEngine' 'Windows.Foundation'
  $languageType = Get-WindowsType 'Windows.Globalization.Language' 'Windows.Foundation'

  if ($LanguageTag) {
    try {
      $language = $languageType::new($LanguageTag)
      $engine = $ocrEngineType::TryCreateFromLanguage($language)
      if ($engine) {
        return $engine
      }
    } catch {
    }
  }

  $fallback = $ocrEngineType::TryCreateFromUserProfileLanguages()
  if ($fallback) {
    return $fallback
  }

  throw 'Windows OCR engine is unavailable on this machine.'
}

function Read-SoftwareBitmapFromFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $storageFileType = Get-WindowsType 'Windows.Storage.StorageFile' 'Windows.Storage'
  $fileAccessModeType = Get-WindowsType 'Windows.Storage.FileAccessMode' 'Windows.Storage'
  $randomAccessStreamType = Get-WindowsType 'Windows.Storage.Streams.IRandomAccessStream' 'Windows.Storage.Streams'
  $bitmapDecoderType = Get-WindowsType 'Windows.Graphics.Imaging.BitmapDecoder' 'Windows.Graphics.Imaging'
  $softwareBitmapType = Get-WindowsType 'Windows.Graphics.Imaging.SoftwareBitmap' 'Windows.Graphics.Imaging'

  $file = Await-Async ($storageFileType::GetFileFromPathAsync($Path)) $storageFileType
  $stream = Await-Async ($file.OpenAsync($fileAccessModeType::Read)) $randomAccessStreamType

  try {
    $decoder = Await-Async ($bitmapDecoderType::CreateAsync($stream)) $bitmapDecoderType
    return Await-Async ($decoder.GetSoftwareBitmapAsync()) $softwareBitmapType
  } finally {
    if ($stream) {
      $stream.Dispose()
    }
  }
}

function Invoke-RegionOcr {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Bitmap]$SourceBitmap,

    [Parameter(Mandatory = $true)]
    [object]$Region,

    [Parameter(Mandatory = $true)]
    [object]$OcrEngine,

    [Parameter(Mandatory = $true)]
    [string]$TempDir
  )

  if ($Region.locked) {
    return @{
      regionId = [string]$Region.id
      text = $null
      confidence = $null
      skipped = $true
      reason = 'locked'
    }
  }

  if (-not [string]::IsNullOrWhiteSpace([string]$Region.sourceText)) {
    return @{
      regionId = [string]$Region.id
      text = $null
      confidence = $null
      skipped = $true
      reason = 'already_filled'
    }
  }

  $x = [int][Math]::Floor([Math]::Max(0, [double]$Region.x))
  $y = [int][Math]::Floor([Math]::Max(0, [double]$Region.y))
  $width = [int][Math]::Ceiling([Math]::Max(0, [double]$Region.width))
  $height = [int][Math]::Ceiling([Math]::Max(0, [double]$Region.height))

  if ($x -ge $SourceBitmap.Width -or $y -ge $SourceBitmap.Height) {
    return @{
      regionId = [string]$Region.id
      text = $null
      confidence = $null
      skipped = $true
      reason = 'invalid_bounds'
    }
  }

  $width = [Math]::Min($width, $SourceBitmap.Width - $x)
  $height = [Math]::Min($height, $SourceBitmap.Height - $y)

  if ($width -le 0 -or $height -le 0) {
    return @{
      regionId = [string]$Region.id
      text = $null
      confidence = $null
      skipped = $true
      reason = 'invalid_bounds'
    }
  }

  $crop = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($crop)

  try {
    $graphics.DrawImage(
      $SourceBitmap,
      (New-Object System.Drawing.Rectangle 0, 0, $width, $height),
      (New-Object System.Drawing.Rectangle $x, $y, $width, $height),
      [System.Drawing.GraphicsUnit]::Pixel
    )

    $cropPath = Join-Path $TempDir "$([string]$Region.id).png"
    $crop.Save($cropPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $crop.Dispose()
  }

  $bitmap = Read-SoftwareBitmapFromFile -Path $cropPath

  try {
    $ocrResultType = Get-WindowsType 'Windows.Media.Ocr.OcrResult' 'Windows.Foundation'
    $result = Await-Async ($OcrEngine.RecognizeAsync($bitmap)) $ocrResultType
    $text = if ($result.Text) { [string]$result.Text } else { '' }
    $text = $text.Trim()

    if ([string]::IsNullOrWhiteSpace($text)) {
      return @{
        regionId = [string]$Region.id
        text = $null
        confidence = $null
        skipped = $true
        reason = 'no_text'
      }
    }

    return @{
      regionId = [string]$Region.id
      text = $text
      confidence = $null
      skipped = $false
      reason = $null
    }
  } finally {
    if ($bitmap) {
      $bitmap.Dispose()
    }
  }
}

$request = Get-Content -Path $RequestPath -Raw | ConvertFrom-Json -Depth 10

if (-not $request.imageDataUrl) {
  throw 'Missing imageDataUrl in OCR request.'
}

$parts = ([string]$request.imageDataUrl) -split ',', 2
if ($parts.Count -ne 2) {
  throw 'Invalid image data URL payload.'
}

$bytes = [Convert]::FromBase64String($parts[1])
$memoryStream = New-Object System.IO.MemoryStream (,$bytes)
$bitmap = [System.Drawing.Bitmap]::FromStream($memoryStream)
$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("scanforge-winocr-" + [guid]::NewGuid().ToString('N'))
[System.IO.Directory]::CreateDirectory($tempDir) | Out-Null

try {
  $engine = New-OcrEngine -LanguageTag $request.sourceLanguage
  $results = foreach ($region in $request.regions) {
    Invoke-RegionOcr -SourceBitmap $bitmap -Region $region -OcrEngine $engine -TempDir $tempDir
  }

  @{
    engine = 'windows-winrt'
    results = @($results)
  } | ConvertTo-Json -Depth 10 -Compress
} finally {
  $bitmap.Dispose()
  $memoryStream.Dispose()
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
