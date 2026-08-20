$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\Plus\traco'

Write-Host '=== 1) WORKER CV (8001) ==='
$workerUp = $false
try {
    $r = Invoke-WebRequest -Uri 'http://localhost:8001/' -UseBasicParsing -TimeoutSec 5
    $workerUp = $true
    Write-Host ("WORKER UP: " + $r.Content)
} catch {
    Write-Host 'WORKER DOWN - iniciando...'
}
if (-not $workerUp) {
    Start-Process -FilePath python -ArgumentList '-m','uvicorn','worker:app','--host','127.0.0.1','--port','8001' `
        -WorkingDirectory 'C:\Users\Plus\traco\packages\ai' `
        -RedirectStandardOutput 'C:\Users\Plus\traco\packages\ai\worker.log' `
        -RedirectStandardError 'C:\Users\Plus\traco\packages\ai\worker-err.log' -NoNewWindow
    Start-Sleep -Seconds 10
    (Invoke-WebRequest -Uri 'http://localhost:8001/' -UseBasicParsing).Content
}

Write-Host '=== 2) BACKEND JAVA (8000) ==='
Start-Process -FilePath 'C:\Program Files\Java\jdk-21.0.11\bin\java.exe' `
    -ArgumentList '-jar','target\traco-api-0.1.0.jar' `
    -WorkingDirectory 'C:\Users\Plus\traco\apps\backend' `
    -RedirectStandardOutput 'C:\Users\Plus\traco\apps\backend\boot.log' `
    -RedirectStandardError 'C:\Users\Plus\traco\apps\backend\boot-err.log' -NoNewWindow
Start-Sleep -Seconds 16

Write-Host '=== 3) LOGIN ==='
$login = Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"email":"demo@traco.com.br","password":"demo123"}'
$tok = $login.token
Write-Host ('LOGIN OK - ' + $login.user.email)
$h = @{ Authorization = ('Bearer ' + $tok) }

Write-Host '=== 4) UPLOAD planta sintetica (PNG real, lido pelo OpenCV) ==='
curl.exe -s -H ('Authorization: Bearer ' + $tok) -F 'file=@C:\Users\Plus\traco\packages\ai\synthetic-plan.png' http://localhost:8000/api/plantas/upload
Write-Host ''

Write-Host '=== 5) aguardando worker CV processar... ==='
Start-Sleep -Seconds 10

Write-Host '=== 6) ANALISES (esperado boxes reais do OpenCV) ==='
$json = Invoke-RestMethod -Uri 'http://localhost:8000/api/analises' -Headers $h
$first = $json[0]
Write-Host ('CODE=' + $first.code + ' STATUS=' + $first.status + ' AREA=' + $first.area + ' ROOMS=' + $first.rooms + ' CONF=' + $first.confidence + ' BOXES=' + @($first.boxes).Count)
Write-Host ('DURACAO=' + $first.durationSeconds + 's (leitura real eh rapida, nao 2500ms fixos)')
$first | ConvertTo-Json -Depth 8
Write-Host '=== FIM E2E ==='