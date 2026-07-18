$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot "backend"
$frontendRoot = Join-Path $projectRoot "frontend"
$pythonPath = Join-Path $backendRoot "venv311\Scripts\python.exe"
$npxPath = (Get-Command "npx.cmd" -ErrorAction SilentlyContinue).Source
$systemJdk = "C:\Program Files\Microsoft\jdk-21.0.11.10-hotspot"
$portableJdk = Join-Path $projectRoot ".local-tools\jdk21\jdk-21.0.11+10"

if (-not (Test-Path -LiteralPath $pythonPath)) {
    throw "Chưa có backend/venv311. Chạy: py -3.11 -m venv backend/venv311"
}

if (-not $npxPath) {
    throw "Không tìm thấy npx. Hãy cài Node.js trước khi chạy local"
}

if (Test-Path -LiteralPath $systemJdk) {
    $jdkRoot = $systemJdk
} elseif (Test-Path -LiteralPath $portableJdk) {
    $jdkRoot = $portableJdk
} else {
    throw "Cần OpenJDK 21 để chạy Firebase Emulator"
}

$env:JAVA_HOME = $jdkRoot
$env:Path = "$(Join-Path $jdkRoot 'bin');$env:Path"
$env:FIREBASE_PROJECT_ID = "zuny-local"
$env:FIREBASE_STORAGE_BUCKET = "zuny-local.appspot.com"
$env:FIREBASE_DATABASE_URL = "http://127.0.0.1:9000?ns=zuny-local"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
$env:FIREBASE_DATABASE_EMULATOR_HOST = "127.0.0.1:9000"
$env:STORAGE_EMULATOR_HOST = "http://127.0.0.1:9199"

function Wait-LocalPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 45
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        $client = [System.Net.Sockets.TcpClient]::new()

        try {
            $client.Connect("127.0.0.1", $Port)
            return
        } catch {
            Start-Sleep -Milliseconds 500
        } finally {
            $client.Dispose()
        }
    }

    throw "Dịch vụ local trên cổng $Port không khởi động kịp thời"
}

$backendOut = Join-Path $backendRoot "backend-local.out.log"
$backendErr = Join-Path $backendRoot "backend-local.err.log"
$frontendOut = Join-Path $frontendRoot "frontend-local.out.log"
$frontendErr = Join-Path $frontendRoot "frontend-local.err.log"
$emulatorOut = Join-Path $projectRoot "firebase-emulator.out.log"
$emulatorErr = Join-Path $projectRoot "firebase-emulator.err.log"

$emulatorArgs = @(
    "--yes", "firebase-tools@15.24.0",
    "emulators:start",
    "--config", "firebase.local.json",
    "--project", "zuny-local",
    "--export-on-exit", ".firebase-data"
)

if (Test-Path -LiteralPath (Join-Path $projectRoot ".firebase-data")) {
    $emulatorArgs += @("--import", ".firebase-data")
}

$emulators = Start-Process `
    -FilePath $npxPath `
    -ArgumentList $emulatorArgs `
    -WorkingDirectory $projectRoot `
    -RedirectStandardOutput $emulatorOut `
    -RedirectStandardError $emulatorErr `
    -WindowStyle Hidden `
    -PassThru

Set-Content -LiteralPath (Join-Path $projectRoot ".local-emulators.pid") -Value $emulators.Id

Wait-LocalPort -Port 9099
Wait-LocalPort -Port 8080

& $pythonPath (Join-Path $backendRoot "seed_local.py")

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
Write-Host "Firebase Emulator PID: $($emulators.Id) - http://127.0.0.1:4000"
Write-Host "Java: $jdkRoot"
