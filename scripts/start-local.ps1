$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot "backend"
$frontendRoot = Join-Path $projectRoot "frontend"
$pythonPath = Join-Path $backendRoot "venv311\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "Chưa có backend/venv311. Chạy: py -3.11 -m venv backend/venv311"
}

$backendOut = Join-Path $backendRoot "backend-local.out.log"
$backendErr = Join-Path $backendRoot "backend-local.err.log"
$frontendOut = Join-Path $frontendRoot "frontend-local.out.log"
$frontendErr = Join-Path $frontendRoot "frontend-local.err.log"

$backend = Start-Process `
    -FilePath $pythonPath `
    -ArgumentList "app.py" `
    -WorkingDirectory $backendRoot `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -WindowStyle Hidden `
    -PassThru

$frontend = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run", "dev", "--", "--host", "127.0.0.1" `
    -WorkingDirectory $frontendRoot `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr `
    -WindowStyle Hidden `
    -PassThru

Set-Content -LiteralPath (Join-Path $projectRoot ".local-backend.pid") -Value $backend.Id
Set-Content -LiteralPath (Join-Path $projectRoot ".local-frontend.pid") -Value $frontend.Id

Write-Host "Backend PID: $($backend.Id) - http://127.0.0.1:5000"
Write-Host "Frontend PID: $($frontend.Id) - http://127.0.0.1:5173"
