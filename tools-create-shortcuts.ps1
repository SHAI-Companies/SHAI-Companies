# Create desktop shortcuts for Superhost Executive Hub
# - Converts SHAI monogram PNG → ICO (one-time)
# - Creates 4 .url files on the user's Desktop pointing to the hub URLs
# Re-runnable: overwrites existing shortcuts safely.

Add-Type -AssemblyName System.Drawing

$BrandDir   = Join-Path $PSScriptRoot 'public\brand'
$PngPath    = Join-Path $BrandDir 'shai-icon-monogram.png'
$IcoPath    = Join-Path $BrandDir 'shai-icon-monogram.ico'
$Desktop    = [Environment]::GetFolderPath('Desktop')
$BaseUrl    = 'http://localhost:3000'

if (-not (Test-Path $PngPath)) { Write-Error "Source PNG not found: $PngPath"; exit 1 }

# Convert PNG -> ICO (only if missing or stale)
if (-not (Test-Path $IcoPath) -or ((Get-Item $PngPath).LastWriteTime -gt (Get-Item $IcoPath).LastWriteTime)) {
    Write-Host "Converting $PngPath -> $IcoPath"
    $bmp = [System.Drawing.Bitmap]::FromFile($PngPath)
    # Resize to 256x256 max for crisp shortcut icon
    $size = 256
    $resized = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($bmp, 0, 0, $size, $size)
    $g.Dispose()
    $hIcon = $resized.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $stream = [System.IO.File]::Open($IcoPath, [System.IO.FileMode]::Create)
    $icon.Save($stream)
    $stream.Close()
    $icon.Dispose()
    $resized.Dispose()
    $bmp.Dispose()
    Write-Host "ICO saved." -ForegroundColor Green
} else {
    Write-Host "ICO already up to date." -ForegroundColor DarkGray
}

# .url files to create on Desktop
$Shortcuts = @(
    @{ Name = 'SHAI Hub';             Url = "$BaseUrl/" }
    @{ Name = 'Executive Dashboard';  Url = "$BaseUrl/dashboard.html" }
    @{ Name = 'Executive Team';       Url = "$BaseUrl/team.html" }
    @{ Name = 'Owner Portal';         Url = "$BaseUrl/owner.html" }
)

foreach ($s in $Shortcuts) {
    $path = Join-Path $Desktop "$($s.Name).url"
    $body = "[InternetShortcut]`r`nURL=$($s.Url)`r`nIconFile=$IcoPath`r`nIconIndex=0`r`n"
    Set-Content -Path $path -Value $body -Encoding ASCII
    Write-Host "Created: $path -> $($s.Url)" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Done. 4 shortcuts placed on your Desktop." -ForegroundColor Green
