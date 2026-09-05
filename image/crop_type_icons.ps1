Add-Type -AssemblyName System.Drawing
$src = "C:\Users\user\Desktop\digimon-tcg\image\type_icon.png"
$outDir = "C:\Users\user\AppData\Local\Temp\claude\C--Users-user-Desktop-digimon-tcg\6df23dd3-b187-4f43-b72f-473eb16eff30\scratchpad\type_icons"
$img = [System.Drawing.Image]::FromFile($src)
$cols = 4
$rows = 2
$cw = [int]($img.Width / $cols)
$ch = [int]($img.Height / $rows)
# 順番: dragon, beast, nature, angel / devil, unknown, legend, baby
$names = @('dragon','beast','nature','angel','devil','unknown','legend','baby')
$i = 0
for($r=0; $r -lt $rows; $r++){
  for($c=0; $c -lt $cols; $c++){
    $rect = New-Object System.Drawing.Rectangle ($c*$cw), ($r*$ch), $cw, $ch
    $bmp = New-Object System.Drawing.Bitmap $cw, $ch
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $name = $names[$i]
    $outPath = Join-Path $outDir "$name.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $name.png"
    $i++
  }
}
$img.Dispose()
