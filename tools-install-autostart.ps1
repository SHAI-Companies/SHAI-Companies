# Install / uninstall a Windows scheduled task that auto-starts the SHAI Hub at user logon.
# Run with: powershell -ExecutionPolicy Bypass -File "C:\Users\Owner\Superhost Hub\tools-install-autostart.ps1"
# Uninstall: powershell -ExecutionPolicy Bypass -File "...\tools-install-autostart.ps1" -Uninstall

param([switch]$Uninstall)

$TaskName    = 'SHAI-Hub-AutoStart'
$HubDir      = $PSScriptRoot
$StartScript = Join-Path $HubDir 'tools-start-hub.ps1'
$LogPath     = Join-Path $HubDir 'hub.log'

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task: $TaskName" -ForegroundColor Yellow
    } else {
        Write-Host "No task '$TaskName' was registered."
    }
    exit 0
}

# 1. Write the wrapper start script (always overwrite — picks up changes to HubDir)
$startBody = @"
# Auto-start SHAI Hub. Triggered by Windows Task Scheduler at user logon.
Set-Location -Path '$HubDir'
`$ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
Add-Content -Path '$LogPath' -Value "`n[`$ts] === SHAI Hub auto-start ==="
# If port 3000 is already in use, skip — server probably already running
`$inUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (`$inUse) {
    Add-Content -Path '$LogPath' -Value "[`$ts] Port 3000 already in use — skipping auto-start."
    exit 0
}
& npm start *>> '$LogPath'
"@
Set-Content -Path $StartScript -Value $startBody -Encoding ASCII
Write-Host "Wrote: $StartScript" -ForegroundColor DarkGray

# 2. Build task: action, trigger, settings, principal
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$StartScript`""

$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 2 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

# 3. Register (replace if exists)
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Replaced existing task." -ForegroundColor DarkGray
}
Register-ScheduledTask -TaskName $TaskName `
    -Action $action -Trigger $trigger -Settings $settings -Principal $principal | Out-Null

Write-Host ""
Write-Host "Installed scheduled task: $TaskName" -ForegroundColor Green
Write-Host "  Runs at logon for: $env:USERDOMAIN\$env:USERNAME"
Write-Host "  Wrapper script:   $StartScript"
Write-Host "  Output log:       $LogPath"
Write-Host ""
Write-Host "Manage from PowerShell:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName        # start now"
Write-Host "  Stop-ScheduledTask  -TaskName $TaskName        # stop"
Write-Host "  Get-ScheduledTaskInfo -TaskName $TaskName      # last run / next run"
Write-Host "  Unregister-ScheduledTask -TaskName $TaskName   # remove"
Write-Host ""
Write-Host "Or via this script: -Uninstall to remove."
