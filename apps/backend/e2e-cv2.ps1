$ErrorActionPreference = 'Continue'
Write-Host '=== LOGIN ==='
$login = Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"email":"demo@traco.com.br","password":"demo123"}'
$tok = $login.token
Write-Host ('LOGIN OK len=' + $tok.Length)
$h = @{ Authorization = ('Bearer ' + $tok) }
Write-Host '=== UPLOAD planta sintetica ==='
curl.exe -s -H ('Authorization: Bearer ' + $tok) -F 'file=@C:\Users\Plus\traco\packages\ai\synthetic-plan.png' http://localhost:8000/api/plantas/upload
Write-Host ''
Start-Sleep -Seconds 8
Write-Host '=== ANALISES ==='
$json = Invoke-RestMethod -Uri 'http://localhost:8000/api/analises' -Headers $h
$first = $json[0]
Write-Host ('CODE=' + $first.code + ' STATUS=' + $first.status + ' AREA=' + $first.area + ' ROOMS=' + $first.rooms + ' CONF=' + $first.confidence + ' BOXES=' + @($first.boxes).Count + ' DUR=' + $first.durationSeconds + 's')