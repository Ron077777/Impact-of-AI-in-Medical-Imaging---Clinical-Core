$ErrorActionPreference = "SilentlyContinue"

foreach ($port in 3000, 8000) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        if ($procId -and $procId -ne $PID) {
            Stop-Process -Id $procId -Force
        }
    }
}

Write-Host "Stopped dev servers on ports 3000 and 8000."
