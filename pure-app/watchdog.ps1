<#
    Watchdog - monitors server.ps1 and restarts if it dies
    Runs hidden, checks every 20 seconds
#>

param([string]$BaseDir = '', [int]$Port = 8000)

if ($BaseDir -eq '') {
    $BaseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
}

$serverScript = Join-Path $BaseDir 'server.ps1'
$portFile = Join-Path $BaseDir 'server.port'
$pidFile = Join-Path $BaseDir 'server.pid'
$watchdogLog = Join-Path $BaseDir 'watchdog.log'
$selfPid = [System.Diagnostics.Process]::GetCurrentProcess().Id

function Write-Log($msg) {
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    try { Add-Content -Path $watchdogLog -Value "[$ts] $msg" -ErrorAction Stop } catch {}
}

function Test-ServerAlive {
    $tcp = $null
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect('127.0.0.1', $Port)
        return $true
    } catch {
        return $false
    } finally {
        if ($tcp) { try { $tcp.Close() } catch {} }
    }
}

function Start-NewServer {
    Remove-Item $portFile -Force -ErrorAction SilentlyContinue
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

    Start-Process powershell.exe -ArgumentList @(
        '-ExecutionPolicy', 'Bypass',
        '-NoProfile',
        '-WindowStyle', 'Hidden',
        '-File', "`"$serverScript`"",
        '-Port', $Port
    ) -WindowStyle Hidden

    for ($i = 0; $i -lt 100; $i++) {
        Start-Sleep -Milliseconds 200
        if (Test-Path $portFile) {
            $content = ''
            try { $content = Get-Content $portFile -Raw -ErrorAction Stop } catch {}
            if ($content -and $content.Trim().Length -gt 0) {
                return $true
            }
        }
    }
    return $false
}

Write-Log "Watchdog started for port $Port (PID: $selfPid)"

$consecutiveFailures = 0

while ($true) {
    Start-Sleep -Seconds 20

    if (Test-ServerAlive) {
        $consecutiveFailures = 0
        continue
    }

    $consecutiveFailures++
    Write-Log "Server DOWN on port $Port (failure #$consecutiveFailures) - restarting..."

    $started = Start-NewServer
    if ($started) {
        Write-Log "Server restarted successfully on port $Port"
        $consecutiveFailures = 0
    } else {
        Write-Log "Server FAILED to restart"
    }
}
