param(
    [switch]$NoClearPorts
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontend = Join-Path $root "frontend"
$python = Join-Path $root "venv\Scripts\python.exe"

function Stop-Port($port) {
    $pids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        if ($procId -and $procId -ne $PID) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

if (!(Test-Path $python)) {
    throw "Missing venv python: $python"
}
if (!(Test-Path (Join-Path $frontend "node_modules"))) {
    throw "Missing frontend dependencies. Run: cd frontend; npm install"
}

if (!$NoClearPorts) {
    Stop-Port 8000
    Stop-Port 3000
}

Start-Process -WindowStyle Minimized -FilePath "cmd.exe" -WorkingDirectory $root -ArgumentList "/c start `"backend`" /min `"$python`" -m uvicorn main:app --host 127.0.0.1 --port 8000"
Start-Process -WindowStyle Minimized -FilePath "cmd.exe" -WorkingDirectory $frontend -ArgumentList "/c start `"frontend`" /min npm.cmd run dev"

Start-Sleep -Seconds 5
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Backend:  http://127.0.0.1:8000/health"
