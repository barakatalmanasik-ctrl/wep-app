# launcher.ps1 — single script that does everything
# Called by تشغيل البرنامج.bat

param([string]$BaseDir = '')

if ($BaseDir -eq '') {
    $BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$ErrorActionPreference = 'SilentlyContinue'

$serverScript = Join-Path $BaseDir 'server.ps1'
$watchdogScript = Join-Path $BaseDir 'watchdog.ps1'
$portFile = Join-Path $BaseDir 'server.port'
$pidFile = Join-Path $BaseDir 'server.pid'
$watchdogLog = Join-Path $BaseDir 'watchdog.log'

# --- Kill all orphaned processes ---
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | ForEach-Object {
    $cl = $_.CommandLine
    if ($cl -and ($cl -match 'server\.ps1' -or $cl -match 'watchdog\.ps1')) {
        Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1

# --- Clean stale files ---
Remove-Item $portFile -Force -ErrorAction SilentlyContinue
Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Remove-Item $watchdogLog -Force -ErrorAction SilentlyContinue

# --- Check if server is alive ---
function Test-PortAlive($port) {
    $tcp = $null
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect('127.0.0.1', $port)
        return $true
    } catch {
        return $false
    } finally {
        if ($tcp) { try { $tcp.Close() } catch {} }
    }
}

$port = 8000
$serverAlive = Test-PortAlive $port

# --- Find available port ---
if ($serverAlive) {
    while (Test-PortAlive $port) { $port++ }
}

# --- Start server ---
if (-not $serverAlive) {
    Start-Process powershell.exe -ArgumentList @(
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-WindowStyle', 'Hidden',
        '-File', "`"$serverScript`"",
        '-Port', $port
    ) -WindowStyle Hidden

    $ready = $false
    for ($i = 0; $i -lt 80; $i++) {
        Start-Sleep -Milliseconds 250
        if (Test-PortAlive $port) { $ready = $true; break }
    }
    if (-not $ready) {
        Write-Host "FAILED: Server did not start within 20 seconds"
        exit 1
    }
}

# --- Start watchdog ---
Start-Process powershell.exe -ArgumentList @(
    '-ExecutionPolicy', 'Bypass',
    '-NoProfile',
    '-WindowStyle', 'Hidden',
    '-File', "`"$watchdogScript`"",
    '-BaseDir', "`"$BaseDir`"",
    '-Port', $port
) -WindowStyle Hidden

# --- Launch browser ---
$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$url = "http://localhost:$port"
if ($chrome) {
    Start-Process $chrome -ArgumentList "--app=$url --window-size=1280,860 --window-position=80,40 --disable-extensions"
} else {
    Start-Process $url
}
