$root = Join-Path $PSScriptRoot 'web'
$url = 'http://127.0.0.1:8766/'
$listener = Get-NetTCPConnection -LocalPort 8766 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    Start-Process -FilePath 'python' -ArgumentList @('-m','http.server','8766','--bind','127.0.0.1') -WorkingDirectory $root -WindowStyle Hidden
    Start-Sleep -Seconds 1
}
Start-Process $url
