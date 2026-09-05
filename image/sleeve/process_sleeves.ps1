Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore

# WebPソース画像はSystem.Drawing(GDI+)では読めないため、WIC(PresentationCore)経由でPNGに変換してから使う
function Convert-WebpToPng($srcPath, $tmpPath) {
  $uri = New-Object System.Uri($srcPath)
  $decoder = [System.Windows.Media.Imaging.BitmapDecoder]::Create($uri, [System.Windows.Media.Imaging.BitmapCreateOptions]::None, [System.Windows.Media.Imaging.BitmapCacheOption]::Default)
  $frame = $decoder.Frames[0]
  $encoder = New-Object System.Windows.Media.Imaging.PngBitmapEncoder
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($frame))
  $stream = [System.IO.File]::Open($tmpPath, [System.IO.FileMode]::Create)
  $encoder.Save($stream)
  $stream.Close()
}

# スリーブ枠(カード比率 287:400 ≒ 0.7175)に収まるよう「contain」方式でリサイズし、
# 余白は白でパディングする(coin/iconの透明パディングと違い、スリーブ元画像の大半が
# 白背景の製品写真なので白パディングの方が馴染む。切り抜き〈crop〉ではなく収める
# 〈contain〉方式にしているのは、ロゴ・テキストが縁ギリギリにあるソースが多く
# 誤って切り落とすリスクを避けるため)
function Process-One($srcPath, $outPath, $targetW, $targetH) {
  $ext = [System.IO.Path]::GetExtension($srcPath).ToLower()
  $actualSrc = $srcPath
  $tmpPng = $null
  if ($ext -eq '.webp') {
    $tmpPng = [System.IO.Path]::GetTempFileName() + '.png'
    Convert-WebpToPng $srcPath $tmpPng
    $actualSrc = $tmpPng
  }
  $img = [System.Drawing.Image]::FromFile($actualSrc)
  $scale = [Math]::Min($targetW / $img.Width, $targetH / $img.Height)
  $newW = [int]([Math]::Round($img.Width * $scale))
  $newH = [int]([Math]::Round($img.Height * $scale))

  $canvas = New-Object System.Drawing.Bitmap $targetW, $targetH
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::White)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $offX = [int](($targetW - $newW) / 2)
  $offY = [int](($targetH - $newH) / 2)
  $g.DrawImage($img, $offX, $offY, $newW, $newH)
  $g.Dispose()

  $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [int64]90)
  $canvas.Save($outPath, $jpegCodec, $params)
  $canvas.Dispose()
  $img.Dispose()
  if ($tmpPng) { Remove-Item $tmpPng -Force -ErrorAction SilentlyContinue }
}

$srcDir = "$PSScriptRoot\..\player\Sleeve"
$map = Get-Content "$PSScriptRoot\sleeve_map.csv" -Encoding UTF8 | Select-Object -Skip 1
foreach ($line in $map) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split '\|'
  $src = $parts[0]
  $outName = $parts[1]
  $srcPath = Join-Path $srcDir $src
  $outPath = Join-Path $PSScriptRoot $outName
  if (Test-Path $srcPath) {
    Process-One $srcPath $outPath 350 488
    Write-Output "OK: $outName"
  } else {
    Write-Output "MISSING: $src"
  }
}
