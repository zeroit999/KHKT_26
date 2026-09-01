$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$backendRoot = Join-Path $projectRoot "backend"
$frontendRoot = Join-Path $projectRoot "frontend"
$pythonPath = Join-Path $backendRoot "venv311\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "Chưa có backend/venv311. Chạy: py -3.11 -m venv backend/venv311"
}

$npmPath = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue).Source

if (-not $npmPath) {
    throw "Không tìm thấy npm. Hãy cài Node.js trước khi chạy local"
}

function Wait-LocalPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    Write-Host "Đang chờ cổng $Port..."

    while ((Get-Date) -lt $deadline) {
        $client = [System.Net.Sockets.TcpClient]::new()

        try {
            $client.Connect("127.0.0.1", $Port)
            Write-Host "Cổng $Port đã sẵn sàng."
            return
        }
        catch {
            Start-Sleep -Milliseconds 500
        }
        finally {
            $client.Dispose()
        }
    }

    throw "Dịch vụ local trên cổng $Port không khởi động kịp thời"
}

function Stop-OldProcess {
    param(
        [string]$PidFile,
        [string]$ServiceName
    )

    if (-not (Test-Path -LiteralPath $PidFile)) {
        return
    }

    $oldPidRaw = (
        Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue |
        Select-Object -First 1
    )

    $oldPid = 0

    if (
        $oldPidRaw -and
        [int]::TryParse(
            $oldPidRaw.ToString().Trim(),
            [ref]$oldPid
        ) -and
        $oldPid -gt 1
    ) {
        $process = Get-Process -Id $oldPid -ErrorAction SilentlyContinue

        if ($process) {
            Write-Host "Đang dừng $ServiceName cũ, PID $oldPid..."

            Stop-Process `
                -Id $oldPid `
                -Force `
                -ErrorAction SilentlyContinue

            Start-Sleep -Milliseconds 500
        }
    }

    Remove-Item `
        -LiteralPath $PidFile `
        -Force `
        -ErrorAction SilentlyContinue
}

$backendOut = Join-Path $backendRoot "backend-local.out.log"
$backendErr = Join-Path $backendRoot "backend-local.err.log"

$frontendOut = Join-Path $frontendRoot "frontend-local.out.log"
$frontendErr = Join-Path $frontendRoot "frontend-local.err.log"

$backendPidFile = Join-Path $projectRoot ".local-backend.pid"
$frontendPidFile = Join-Path $projectRoot ".local-frontend.pid"

Stop-OldProcess `
    -PidFile $frontendPidFile `
    -ServiceName "frontend"

Stop-OldProcess `
    -PidFile $backendPidFile `
    -ServiceName "backend"

Write-Host "Đang tạo/cập nhật dữ liệu PostgreSQL local..."

& $pythonPath (Join-Path $backendRoot "seed_local.py")

if ($LASTEXITCODE -ne 0) {
    throw "seed_local.py thất bại với exit code $LASTEXITCODE"
}

Write-Host "Đang khởi động backend..."

$backend = Start-Process `
    -FilePath $pythonPath `
    -ArgumentList "app.py" `
    -WorkingDirectory $backendRoot `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -WindowStyle Hidden `
    -PassThru

Set-Content `
    -LiteralPath $backendPidFile `
    -Value $backend.Id

try {
    Wait-LocalPort `
        -Port 5000 `
        -TimeoutSeconds 45
}
catch {
    Write-Host ""
    Write-Host "Backend không khởi động được." -ForegroundColor Red
    Write-Host "Xem log:"
    Write-Host "  $backendErr"

    Stop-Process `
        -Id $backend.Id `
        -Force `
        -ErrorAction SilentlyContinue

    Remove-Item `
        -LiteralPath $backendPidFile `
        -Force `
        -ErrorAction SilentlyContinue

    throw
}

Write-Host "Đang khởi động frontend..."

$frontend = Start-Process `
    -FilePath $npmPath `
    -ArgumentList "run", "dev", "--", "--host", "127.0.0.1" `
    -WorkingDirectory $frontendRoot `
    -RedirectStandardOutput $frontendOut `
    -RedirectStandardError $frontendErr `
    -WindowStyle Hidden `
    -PassThru

Set-Content `
    -LiteralPath $frontendPidFile `
    -Value $frontend.Id

try {
    Wait-LocalPort `
        -Port 5173 `
        -TimeoutSeconds 45
}
catch {
    Write-Host ""
    Write-Host "Frontend không khởi động được." -ForegroundColor Red
    Write-Host "Xem log:"
    Write-Host "  $frontendErr"

    Stop-Process `
        -Id $frontend.Id `
        -Force `
        -ErrorAction SilentlyContinue

    Remove-Item `
        -LiteralPath $frontendPidFile `
        -Force `
        -ErrorAction SilentlyContinue

    throw
}

Write-Host ""
Write-Host "=============================================="
Write-Host "ZUNY local đã được khởi động"
Write-Host "=============================================="
Write-Host "Backend PID:          $($backend.Id)"
Write-Host "Backend:              http://127.0.0.1:5000"
Write-Host ""
Write-Host "Frontend PID:         $($frontend.Id)"
Write-Host "Frontend:             http://127.0.0.1:5173"
Write-Host ""
Write-Host "Database:             PostgreSQL"
Write-Host "=============================================="
Write-Host ""
Write-Host "Log backend:"
Write-Host "  $backendErr"
Write-Host ""
Write-Host "Log frontend:"
Write-Host "  $frontendErr"
