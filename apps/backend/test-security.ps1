$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\Plus\traco\apps\backend'
$base = 'http://localhost:8000'

Write-Host '=== 1. SECURITY HEADERS ==='
$r = Invoke-WebRequest -Uri $base -UseBasicParsing
foreach ($hname in @('X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy')) {
  if ($r.Headers[$hname]) { Write-Host ('OK ' + $hname + ': ' + $r.Headers[$hname]) } else { Write-Host ('MISSING ' + $hname) }
}

Write-Host '=== 2. MAGIC BYTES (fake.pdf com texto) ==='
Set-Content -Path 'fake.pdf' -Value 'ISSO NAO E UM PDF REAL'
curl.exe -s -F 'file=@fake.pdf' $base/upload/
Write-Host ''

Write-Host '=== 3. UPLOAD VALIDO (magic %PDF ok) ==='
curl.exe -s -F 'file=@test-planta.pdf' $base/upload/
Write-Host ''

Write-Host '=== 4. VALIDACAO DTO (senha curta => 400) ==='
try {
  Invoke-RestMethod -Uri "$base/api/auth/register" -Method Post -ContentType 'application/json' -Body '{"name":"X","email":"x@x.com","password":"123"}' | Out-Null
  Write-Host 'ERRO: nao deveria passar'
} catch { Write-Host ('STATUS ' + [int]$_.Exception.Response.StatusCode) }

Write-Host '=== 5. LOCKOUT (5 falhas => 423 na 6a) ==='
for ($i=1; $i -le 6; $i++) {
  try {
    Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"lock@traco.com.br","password":"errada"}' | Out-Null
    Write-Host "tentativa $i : 200 (inesperado)"
  } catch { Write-Host ('tentativa ' + $i + ' : ' + [int]$_.Exception.Response.StatusCode) }
}

Write-Host '=== 6. RATE LIMIT (rajada de 12 => 429 no final) ==='
Start-Sleep -Seconds 61
for ($i=1; $i -le 12; $i++) {
  try {
    Invoke-RestMethod -Uri "$base/api/auth/login" -Method Post -ContentType 'application/json' -Body '{"email":"rate@traco.com.br","password":"x"}' | Out-Null
    Write-Host "req $i : 200"
  } catch { Write-Host ('req ' + $i + ' : ' + [int]$_.Exception.Response.StatusCode) }
}

Write-Host '=== 7. SEM VAZAMENTO DE SENHA ==='
Start-Sleep -Seconds 61
$reg = Invoke-RestMethod -Uri "$base/api/auth/register" -Method Post -ContentType 'application/json' -Body '{"name":"Sec Test","email":"sec@traco.com.br","password":"senha123","role":"engenheiro"}'
$json = $reg | ConvertTo-Json -Depth 5
if ($json -match 'password') { Write-Host 'LEAK: password no register' } else { Write-Host 'OK: register sem password' }
$h = @{ Authorization = ('Bearer ' + $reg.token) }
$me = (Invoke-RestMethod -Uri "$base/api/auth/me" -Headers $h) | ConvertTo-Json
if ($me -match 'password') { Write-Host 'LEAK: password no /me' } else { Write-Host 'OK: /me sem password' }

Write-Host '=== FIM ==='