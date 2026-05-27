# Install / uninstall a Windows scheduled task that auto-starts the SHAI Companies Hub at user logon.
# Run with: powershell -ExecutionPolicy Bypass -File "C:\Users\Owner\SHAI Companies\tools-install-autostart.ps1"
# Uninstall: powershell -ExecutionPolicy Bypass -File "...\tools-install-autostart.ps1" -Uninstall
#
# This installer does NOT overwrite the wrapper script. tools-start-hub.ps1 is
# maintained as a checked-in file (uses WMI detached-spawn pattern per
# HUB_OPERATIONS.md). The installer only verifies the wrapper exists, then
# registers the scheduled task to invoke it.

param([switch]$Uninstall)

$TaskName    = 'SHAI-Companies-AutoStart'
$HubDir      = $PSScriptRoot
$StartScript = Join-Path $HubDir 'tools-start-hub.ps1'
$LogPath     = Join-Path $HubDir 'shai-companies.log'

if ($Uninstall) {
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Removed scheduled task: $TaskName" -ForegroundColor Yellow
    } else {
        Write-Host "No task '$TaskName' was registered."
    }
    exit 0
}

# 1. Verify the wrapper exists. The installer does NOT generate it -- it must
#    be checked in as a separate file so it can use the WMI detached-spawn
#    pattern (which is hard to express correctly in an inline here-string).
if (-not (Test-Path $StartScript)) {
    Write-Host "ERROR: Wrapper script not found at: $StartScript" -ForegroundColor Red
    Write-Host "       Restore tools-start-hub.ps1 from git before re-running this installer." -ForegroundColor Red
    exit 1
}

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
Write-Host "  Binds port:       3001"
Write-Host ""
Write-Host "Manage from PowerShell:"
Write-Host "  Start-ScheduledTask -TaskName $TaskName        # start now"
Write-Host "  Stop-ScheduledTask  -TaskName $TaskName        # stop"
Write-Host "  Get-ScheduledTaskInfo -TaskName $TaskName      # last run / next run"
Write-Host "  Unregister-ScheduledTask -TaskName $TaskName   # remove"
Write-Host ""
Write-Host "Or via this script: -Uninstall to remove."
