Add-Type -AssemblyName System.Drawing

$oUmlaut = [char]0x00D6  # OE
$oeUmlaut = [char]0x00F6 # oe
$enDash = [char]0x2013

$width = 450
$height = 280
$brandRed = [System.Drawing.Color]::FromArgb(166, 25, 46)  # #a6192e

$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

# Background
$g.Clear([System.Drawing.Color]::White)

# Top brand bar
$barHeight = 8
$brush = New-Object System.Drawing.SolidBrush $brandRed
$g.FillRectangle($brush, 0, 0, $width, $barHeight)

# Title
$titleFont = New-Object System.Drawing.Font("Segoe UI", 15, [System.Drawing.FontStyle]::Bold)
$titleBrush = New-Object System.Drawing.SolidBrush $brandRed
$titleText = "TRAF{0} Katalog Generator" -f $oUmlaut
$g.DrawString($titleText, $titleFont, $titleBrush, (New-Object System.Drawing.PointF(30, 40)))

# Subtitle / status text
$textFont = New-Object System.Drawing.Font("Segoe UI", 10.5)
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(60, 60, 60))
$subtitleText = "Wird vorbereitet {0} bitte warten..." -f $enDash
$g.DrawString($subtitleText, $textFont, $textBrush, (New-Object System.Drawing.PointF(30, 90)))

$noteFont = New-Object System.Drawing.Font("Segoe UI", 9.5)
$noteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(100, 100, 100))
$noteText = "Der erste Start vom Netzlaufwerk kann bis zu einer`nMinute dauern. Bitte das Programm in dieser Zeit`nnicht erneut {0}ffnen." -f $oeUmlaut
$g.DrawString($noteText, $noteFont, $noteBrush, (New-Object System.Drawing.PointF(30, 130)))

# Footer bar
$g.FillRectangle($brush, 0, $height - $barHeight, $width, $barHeight)

$g.Dispose()
$bmp.Save("C:\Users\admin\Documents\Documents\Trafoe\pdf-catalog-generator\pdf-catalog-generator-desktop\assets\splash.bmp", [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Dispose()

Write-Output "Splash image created"
