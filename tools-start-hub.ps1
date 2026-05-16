# Auto-start SHAI Hub. Triggered by Windows Task Scheduler at user logon.
# Uses WMI Win32_Process.Create to spawn node DETACHED — the hub survives the
# wrapper's exit, unlike `& npm start` which gets killed when the task's job
# object terminates.

$HubDir  = 'C:\Users\Owner\Superhost Hub'
$LogPath = Join-Path $HubDir 'hub.log'

Set-Location -Path $HubDir
$ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
Add-Content -Path $LogPath -Value "`n[$ts] === SHAI Hub auto-start ==="

# Skip if already running on port 3000
$inUse = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($inUse) {
    Add-Content -Path $LogPath -Value "[$ts] Port 3000 already in use - skipping auto-start."
    exit 0
}

# Defensive layer — also bail if any node.exe is already running server.js
# from this hub directory. Catches the race where port 3000 is briefly free
# (TIME_WAIT or just-started node not yet bound) but a hub instance already
# exists. Without this we accumulated 7 zombie nodes on 2026-05-06.
try {
    $existing = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -match 'server\.js' -and $_.CommandLine -match [regex]::Escape($HubDir) }
    if ($existing) {
        $pidList = ($existing | ForEach-Object { $_.ProcessId }) -join ', '
        Add-Content -Path $LogPath -Value "[$ts] Hub node.exe already running (PIDs: $pidList) - skipping auto-start."
        exit 0
    }
} catch {
    Add-Content -Path $LogPath -Value "[$ts] node.exe scan failed (continuing anyway): $($_.Exception.Message)"
}

# Build the command line. cmd.exe /c handles shell redirects (>> and 2>&1).
# Quoting the log path defends against spaces in the directory name.
$cmdLine = 'cmd.exe /c node server.js >> "' + $LogPath + '" 2>&1'

# Spawn detached. WMI Win32_Process.Create creates the process under
# svchost as the parent, so when this wrapper script exits and the task
# instance is "done," the spawned node process is unaffected.
$result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{
    CommandLine      = $cmdLine
    CurrentDirectory = $HubDir
}

if ($result.ReturnValue -eq 0) {
    Add-Content -Path $LogPath -Value "[$ts] Spawned hub PID $($result.ProcessId) (detached). Wrapper exiting cleanly."
} else {
    Add-Content -Path $LogPath -Value "[$ts] FAILED to spawn hub. Win32_Process.Create returned code $($result.ReturnValue)."
}

exit 0
