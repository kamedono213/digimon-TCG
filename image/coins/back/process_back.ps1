Add-Type -AssemblyName System.Drawing

function Get-TrimBounds($img, $sampleW) {
  $w = $img.Width; $h = $img.Height
  $scale = $sampleW / $w
  $sh = [int]([math]::Round($h * $scale))
  $thumb = New-Object System.Drawing.Bitmap $sampleW, $sh
  $g = [System.Drawing.Graphics]::FromImage($thumb)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $sampleW, $sh)
  $g.Dispose()

  $minX = $sampleW; $minY = $sh; $maxX = 0; $maxY = 0
  $found = $false
  for ($y = 0; $y -lt $sh; $y++) {
    for ($x = 0; $x -lt $sampleW; $x++) {
      $a = $thumb.GetPixel($x, $y).A
      if ($a -gt 12) {
        $found = $true
        if ($x -lt $minX) { $minX = $x }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  $thumb.Dispose()
  if (-not $found) { return @{X=0; Y=0; W=$w; H=$h} }
  $rx = $w / $sampleW; $ry = $h / $sh
  $x0 = [math]::Max(0, [int]([math]::Floor($minX * $rx)))
  $y0 = [math]::Max(0, [int]([math]::Floor($minY * $ry)))
  $x1 = [math]::Min($w, [int]([math]::Ceiling(($maxX+1) * $rx)))
  $y1 = [math]::Min($h, [int]([math]::Ceiling(($maxY+1) * $ry)))
  return @{X=$x0; Y=$y0; W=($x1-$x0); H=($y1-$y0)}
}

function Process-One($srcPath, $outPath, $finalSize) {
  $img = [System.Drawing.Image]::FromFile($srcPath)
  $bounds = Get-TrimBounds $img 120
  # 上下左右に少し余白を残す(キャラが枠ギリギリにならないよう5%マージン)
  $marginX = [int]([math]::Round($bounds.W * 0.06))
  $marginY = [int]([math]::Round($bounds.H * 0.06))
  $x0 = [math]::Max(0, $bounds.X - $marginX)
  $y0 = [math]::Max(0, $bounds.Y - $marginY)
  $x1 = [math]::Min($img.Width, $bounds.X + $bounds.W + $marginX)
  $y1 = [math]::Min($img.Height, $bounds.Y + $bounds.H + $marginY)
  $cw = $x1 - $x0; $ch = $y1 - $y0

  $side = [math]::Max($cw, $ch)
  $sq = New-Object System.Drawing.Bitmap $side, $side
  $sq.MakeTransparent()
  $g = [System.Drawing.Graphics]::FromImage($sq)
  $g.Clear([System.Drawing.Color]::Transparent)
  $offX = [int](($side - $cw) / 2)
  $offY = [int](($side - $ch) / 2)
  $srcRect = New-Object System.Drawing.Rectangle $x0, $y0, $cw, $ch
  $destRect = New-Object System.Drawing.Rectangle $offX, $offY, $cw, $ch
  $g.DrawImage($img, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()

  $final = New-Object System.Drawing.Bitmap $finalSize, $finalSize
  $final.MakeTransparent()
  $g2 = [System.Drawing.Graphics]::FromImage($final)
  $g2.Clear([System.Drawing.Color]::Transparent)
  $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g2.DrawImage($sq, 0, 0, $finalSize, $finalSize)
  $g2.Dispose()

  $final.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $final.Dispose()
  $sq.Dispose()
  $img.Dispose()
}

$map = Get-Content "$PSScriptRoot\back_map.csv" -Encoding UTF8 | Select-Object -Skip 1
foreach ($line in $map) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line -split '\|'
  $src = $parts[0]
  $outName = $parts[1]
  $srcPath = Join-Path $PSScriptRoot $src
  $outPath = Join-Path $PSScriptRoot $outName
  if (Test-Path $srcPath) {
    Process-One $srcPath $outPath 320
    Write-Output "OK: $outName"
  } else {
    Write-Output "MISSING: $src"
  }
}
