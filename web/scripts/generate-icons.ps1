Add-Type -AssemblyName System.Drawing

$outputDir = Join-Path $PSScriptRoot "..\public\icons"
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

function Create-AppIcon {
    param (
        [int]$size,
        [string]$outputPath,
        [bool]$isMaskable = $false
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Background
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $cTop = [System.Drawing.ColorTranslator]::FromHtml("#0f766e") # Teal 700
    $cBottom = [System.Drawing.ColorTranslator]::FromHtml("#134e4a") # Teal 900
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $cTop, $cBottom, 45.0)

    if ($isMaskable) {
        $g.FillRectangle($brush, $rect)
    } else {
        # Rounded rectangle for regular icons
        $cornerRad = [int]($size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $cornerRad * 2
        $path.AddArc(0, 0, $d, $d, 180, 90)
        $path.AddArc($size - $d, 0, $d, $d, 270, 90)
        $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
        $path.AddArc(0, $size - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $g.FillPath($brush, $path)

        # Subtle gold/cyan border
        $borderPen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#2dd4bf"), [math]::Max(2, $size * 0.015))
        $g.DrawPath($borderPen, $path)
        $borderPen.Dispose()
        $path.Dispose()
    }

    # Inner decorative badge
    $badgeSize = [int]($size * 0.6)
    $badgeX = [int](($size - $badgeSize) / 2)
    $badgeY = [int](($size - $badgeSize) / 2)
    $badgeRect = New-Object System.Drawing.Rectangle($badgeX, $badgeY, $badgeSize, $badgeSize)
    $badgeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
    $g.FillEllipse($badgeBrush, $badgeRect)
    $badgeBrush.Dispose()

    # Draw "R" Letter
    $fontSize = [float]($size * 0.40)
    $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)

    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center

    # Slight vertical offset for optical centering
    $textRect = New-Object System.Drawing.RectangleF(0.0, [float](-$size * 0.04), [float]$size, [float]$size)
    $g.DrawString("R", $font, $textBrush, $textRect, $format)

    # Accent diamond/star at top right
    $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#fde047"))
    $ax = [float]($size * 0.72)
    $ay = [float]($size * 0.26)
    $ar = [float]($size * 0.07)
    $p1 = New-Object System.Drawing.PointF($ax, ($ay - $ar))
    $p2 = New-Object System.Drawing.PointF(($ax + $ar), $ay)
    $p3 = New-Object System.Drawing.PointF($ax, ($ay + $ar))
    $p4 = New-Object System.Drawing.PointF(($ax - $ar), $ay)
    $points = [System.Drawing.PointF[]]@($p1, $p2, $p3, $p4)
    $g.FillPolygon($accentBrush, $points)
    $accentBrush.Dispose()

    # Subtext "ROOC" at bottom if size is large enough
    if ($size -ge 180) {
        $subFont = New-Object System.Drawing.Font($fontFamily, [float]($size * 0.10), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
        $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#a7f3d0")) # Mint 200
        $subRect = New-Object System.Drawing.RectangleF(0.0, [float]($size * 0.72), [float]$size, [float]($size * 0.2))
        $g.DrawString("ROOC", $subFont, $subBrush, $subRect, $format)
        $subFont.Dispose()
        $subBrush.Dispose()
    }

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $format.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()

    Write-Host "Generated: $outputPath ($($size)x$($size))"
}

# Generate PWA Icons
Create-AppIcon -size 192 -outputPath (Join-Path $outputDir "icon-192x192.png") -isMaskable $false
Create-AppIcon -size 512 -outputPath (Join-Path $outputDir "icon-512x512.png") -isMaskable $false
Create-AppIcon -size 512 -outputPath (Join-Path $outputDir "icon-maskable-512x512.png") -isMaskable $true

$publicDir = Join-Path $PSScriptRoot "..\public"
Create-AppIcon -size 180 -outputPath (Join-Path $publicDir "apple-touch-icon.png") -isMaskable $false
Create-AppIcon -size 64 -outputPath (Join-Path $publicDir "favicon.png") -isMaskable $false

Write-Host "All PWA icons generated successfully."
