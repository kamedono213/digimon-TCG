Add-Type -AssemblyName System.Drawing
$dir = "C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-digimon-tcg\6df23dd3-b187-4f43-b72f-473eb16eff30\scratchpad\type_icons"
$names = @('dragon','beast','nature','angel','devil','unknown','legend','baby')
$size = 64
foreach($name in $names){
  $src = Join-Path $dir "$name.png"
  $img = [System.Drawing.Image]::FromFile($src)
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $bmp.SetResolution($img.HorizontalResolution, $img.VerticalResolution)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $size, $size)
  $g.Dispose()
  $img.Dispose()
  $outPath = Join-Path $dir "${name}_small.png"
  $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
Write-Output "done"
