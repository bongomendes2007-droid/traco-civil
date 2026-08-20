$ErrorActionPreference = 'Continue'
Write-Host '=== 0) restart worker CV (python) ==='
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*worker:app*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 2
Start-Process -FilePath python -ArgumentList '-m','uvicorn','worker:app','--host','127.0.0.1','--port','8001' `
    -WorkingDirectory 'C:\Users\Plus\traco\packages\ai' `
    -RedirectStandardOutput 'C:\Users\Plus\traco\packages\ai\worker.log' `
    -RedirectStandardError 'C:\Users\Plus\traco\packages\ai\worker-err.log' -NoNewWindow
Start-Sleep -Seconds 8
try { (Invoke-WebRequest -Uri 'http://127.0.0.1:8001/' -UseBasicParsing -TimeoutSec 5).Content } catch { Write-Host 'WORKER DOWN' }
Write-Host '=== 1) rebuild + restart java + e2e ==='
& powershell -ExecutionPolicy Bypass -File 'C:\Users\Plus\traco\apps\backend\restart-e2e.ps1'