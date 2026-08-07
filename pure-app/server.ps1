<#
    Local HTTP Server — Barakat Al-Manasek v2
    TcpListener: works WITHOUT admin privileges
    Writes port and PID to files for launcher
    Cleans stale files on startup
#>

param([int]$Port = 0)

$ErrorActionPreference = 'SilentlyContinue'
$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Definition

# ── Clean stale files immediately ──
Remove-Item "$baseDir\server.port" -Force -ErrorAction SilentlyContinue
Remove-Item "$baseDir\server.pid" -Force -ErrorAction SilentlyContinue

# ── Kill orphaned server processes from same directory ──
try {
    $myPid = [System.Diagnostics.Process]::GetCurrentProcess().Id
    $allPs = Get-Process powershell -ErrorAction SilentlyContinue
    foreach ($p in $allPs) {
        if ($p.Id -ne $myPid) {
            try {
                $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($p.Id)" -ErrorAction SilentlyContinue).CommandLine
                if ($cmdLine -and $cmdLine.Contains('server.ps1')) {
                    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 200
                }
            } catch {}
        }
    }
} catch {}

# ── MIME types ──
$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.json' = 'application/manifest+json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff' = 'font/woff'
    '.woff2'= 'font/woff2'
    '.ttf'  = 'font/ttf'
    '.webp' = 'image/webp'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
    '.pdf'  = 'application/pdf'
}

# ── Find available port ──
if ($Port -eq 0) {
    $Port = 8000
    for ($i = 0; $i -lt 50; $i++) {
        $testPort = $Port + $i
        $inUse = $false
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect('127.0.0.1', $testPort)
            $tcp.Close()
            $inUse = $true
        } catch { $inUse = $false }
        if (-not $inUse) { $Port = $testPort; break }
    }
}

# ── Write PID file ──
$myPid2 = [System.Diagnostics.Process]::GetCurrentProcess().Id
[System.IO.File]::WriteAllText("$baseDir\server.pid", [string]$myPid2)

# ── Start listener ──
$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Loopback, $Port)
$listener = New-Object System.Net.Sockets.TcpListener($endpoint)
$listener.Start()

# ── Write port file (signals launcher that server is ready) ──
[System.IO.File]::WriteAllText("$baseDir\server.port", [string]$Port)

# ── Serve loop ──
try {
    while ($true) {
        if (-not $listener.Pending()) {
            Start-Sleep -Milliseconds 30
            continue
        }

        $client = $listener.AcceptTcpClient()
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000

        try {
            $bytes = New-Object byte[] 4096
            $read = $stream.Read($bytes, 0, $bytes.Length)
            $request = [System.Text.Encoding]::ASCII.GetString($bytes, 0, $read)

            $firstLine = $request.Split("`r`n")[0]
            $parts = $firstLine.Split(' ')
            $requestPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
            if ($requestPath -eq '/') { $requestPath = '/index.html' }

            $localPath = $requestPath.TrimStart('/')
            $filePath = Join-Path $baseDir ($localPath.Replace('/', '\'))

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = $mimeTypes[$ext]
                if (-not $contentType) { $contentType = 'application/octet-stream' }

                $fileBytes = [System.IO.File]::ReadAllBytes($filePath)

                $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($fileBytes.Length)`r`nConnection: close`r`n"
                if ($ext -eq '.json') { $header += "Access-Control-Allow-Origin: *`r`n" }
                if ($ext -in '.png','.jpg','.gif','.svg','.woff','.woff2','.ttf') {
                    $header += "Cache-Control: public, max-age=86400`r`n"
                }
                $header += "`r`n"

                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($fileBytes, 0, $fileBytes.Length)
                $stream.Flush()
            } else {
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
                $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
                $stream.Write($headerBytes, 0, $headerBytes.Length)
                $stream.Write($body, 0, $body.Length)
                $stream.Flush()
            }
        } catch {} finally {
            try { $client.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
    Remove-Item "$baseDir\server.port" -Force -ErrorAction SilentlyContinue
    Remove-Item "$baseDir\server.pid" -Force -ErrorAction SilentlyContinue
}
