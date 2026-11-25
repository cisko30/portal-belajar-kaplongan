param (
    [int]$Port = 8080
)

$prefix = "http://localhost:$Port/"
$root = Join-Path $PSScriptRoot "public"

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    Write-Error "Gagal menjalankan listener di $prefix : $($_.Exception.Message)"
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Portal Belajar Server Aktif!" -ForegroundColor Green
Write-Host " URL: $prefix" -ForegroundColor Yellow
Write-Host " Halaman utama : $prefix"
Write-Host " Login Cloud   : ${prefix}auth.html"
Write-Host " Dashboard Guru: ${prefix}dashboard-guru.html"
Write-Host " Dashboard Murid: ${prefix}dashboard-murid.html"
Write-Host " Game Quiz     : ${prefix}game-quiz.html"
Write-Host " Tekan Ctrl+C untuk menghentikan server." -ForegroundColor Gray
Write-Host "==========================================" -ForegroundColor Cyan

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".ico"  = "image/x-icon"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".webp" = "image/webp"
}

# Catalog, activity, and accounts state in memory for local dev
$catalogState = @{
    materi = @()
    tugas = @()
    lkpd = @()
    quiz = @()
    pengumuman = @()
    updatedAt = "dev-init"
}
$activityState = @{
    tugas = @{}
    lkpd = @{}
    quiz = @{}
    absensi = @{}
}
$accountsState = @()

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, x-guru-passphrase")

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.OutputStream.Close()
            continue
        }

        $rawPath = $request.Url.AbsolutePath
        $path = $rawPath
        if ($path -eq "/" -or $path -eq "") {
            $path = "/portal-belajar.html"
        }

        # Local in-memory API backend for full bidirectional sync during dev
        if ($path.StartsWith("/api/drive/materials")) {
            $response.ContentType = "application/json"
            $q = $request.QueryString

            if ($q["teacher-session"] -eq "1" -or $q["teacher-login"] -eq "1" -or $q["admin-login"] -eq "1") {
                $buf = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($q["login"] -eq "1") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $reqObj = ($reader.ReadToEnd() | ConvertFrom-Json)
                $acc = $accountsState | Where-Object { $_.nis -eq $reqObj.nis } | Select-Object -First 1
                if ($acc) { $acc.terakhirMasuk = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }
                else { $acc = @{ nis = $reqObj.nis; nama = "Siswa " + $reqObj.nis; kelas = "X-1" } }
                $buf = [System.Text.Encoding]::UTF8.GetBytes((@{ ok = $true; account = $acc } | ConvertTo-Json -Depth 6))
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($q["catalog"] -eq "1") {
                if ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                    $bodyObj = ($reader.ReadToEnd() | ConvertFrom-Json)
                    foreach ($k in @("materi","tugas","lkpd","quiz","pengumuman")) {
                        if ($null -ne $bodyObj.$k) { $catalogState[$k] = @($bodyObj.$k) }
                    }
                    $catalogState["updatedAt"] = [System.DateTime]::UtcNow.ToString("o")
                    $buf = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $catalogState -Depth 10))
                } else {
                    $jsonStr = ConvertTo-Json $catalogState -Depth 10
                    $buf = [System.Text.Encoding]::UTF8.GetBytes($jsonStr)
                }
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($q["activity"] -eq "1") {
                if ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                    $bodyObj = ($reader.ReadToEnd() | ConvertFrom-Json)
                    foreach ($k in @("tugas","lkpd","quiz","absensi")) {
                        if ($null -ne $bodyObj.$k) { $activityState[$k] = $bodyObj.$k }
                    }
                }
                $buf = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $activityState -Depth 10))
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($q["submit"] -eq "1" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $subObj = ($reader.ReadToEnd() | ConvertFrom-Json)
                $jenis = [string]$subObj.jenis
                $itemKey = [string]$subObj.itemKey
                if (-not $activityState[$jenis]) { $activityState[$jenis] = @{} }
                $bucket = @($activityState[$jenis][$itemKey]) | Where-Object { $_ -and $_.userId -ne $subObj.entry.userId }
                $bucket += $subObj.entry
                $activityState[$jenis][$itemKey] = $bucket
                $buf = [System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json $activityState -Depth 10))
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($q["accounts"] -eq "1") {
                if ($request.HttpMethod -eq "POST") {
                    $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                    $accObj = ($reader.ReadToEnd() | ConvertFrom-Json)
                    if ($accObj.action -eq "delete") {
                        $accountsState = @($accountsState | Where-Object { $_.nis -ne $accObj.nis })
                    } elseif ($accObj.action -eq "bulk" -and $accObj.accounts) {
                        foreach ($row in $accObj.accounts) {
                            $accountsState = @($accountsState | Where-Object { $_.nis -ne $row.nis }) + @{ nis=$row.nis; nama=$row.nama; kelas=$row.kelas }
                        }
                    } elseif ($accObj.nis) {
                        $accountsState = @($accountsState | Where-Object { $_.nis -ne $accObj.nis }) + @{ nis=$accObj.nis; nama=$accObj.nama; kelas=$accObj.kelas }
                    }
                }
                $buf = [System.Text.Encoding]::UTF8.GetBytes((@{ accounts = $accountsState } | ConvertTo-Json -Depth 6))
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            if ($q["reset"] -eq "1" -and $request.HttpMethod -eq "POST") {
                $catalogState = @{ materi=@(); tugas=@(); lkpd=@(); quiz=@(); pengumuman=@(); updatedAt="reset" }
                $activityState = @{ tugas=@{}; lkpd=@{}; quiz=@{}; absensi=@{} }
                $accountsState = @()
                $buf = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true}')
                $response.OutputStream.Write($buf, 0, $buf.Length)
                $response.OutputStream.Close()
                continue
            }

            $defaultJson = '{"ok":true,"ready":false,"passphraseRequired":true,"maxBytes":52428800}'
            $buf = [System.Text.Encoding]::UTF8.GetBytes($defaultJson)
            $response.OutputStream.Write($buf, 0, $buf.Length)
            $response.OutputStream.Close()
            continue
        }

        $filePath = Join-Path $root ($path.TrimStart('/').Replace('/', '\'))
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime = $mimeTypes[$ext]
            if (-not $mime) { $mime = "application/octet-stream" }
            $response.ContentType = $mime
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $buf = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $response.OutputStream.Write($buf, 0, $buf.Length)
        }
        $response.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
