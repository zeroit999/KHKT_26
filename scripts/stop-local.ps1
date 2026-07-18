$projectRoot = Split-Path -Parent $PSScriptRoot

function Stop-ProcessTree {
    param([int]$RootProcessId)

    $children = Get-CimInstance Win32_Process |
        Where-Object { $_.ParentProcessId -eq $RootProcessId }

    foreach ($child in $children) {
        Stop-ProcessTree -RootProcessId $child.ProcessId
    }

    Stop-Process -Id $RootProcessId -ErrorAction SilentlyContinue
}

foreach ($name in @("backend", "frontend")) {
    $pidFile = Join-Path $projectRoot ".local-$name.pid"

    if (Test-Path -LiteralPath $pidFile) {
        $processId = [int](Get-Content -LiteralPath $pidFile -Raw)
        Stop-ProcessTree -RootProcessId $processId
        Remove-Item -LiteralPath $pidFile -Force
        Write-Host "Đã dừng $name (PID $processId)"
    }
}
