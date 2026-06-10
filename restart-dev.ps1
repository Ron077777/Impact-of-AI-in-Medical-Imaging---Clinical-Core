$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

& (Join-Path $root "stop-dev.ps1")
Start-Sleep -Seconds 1
& (Join-Path $root "start-dev.ps1")
