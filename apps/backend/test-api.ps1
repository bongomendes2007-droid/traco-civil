$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\Plus\traco\apps\backend'

Write-Host '=== REGISTER ==='
try {
  $reg = Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/register' -Method Post -ContentType 'application/json' -Body '{"name":"Teste Silva","email":"teste@traco.com.br","password":"senha123","role":"arquiteto"}'
  Write-Host ("REGISTER OK - token len: " + $reg.token.Length)
} catch {
  Write-Host ("REGISTER (esperado falhar se ja existe): " + $_.Exception.Message)
}

Write-Host '=== LOGIN demo ==='
$login = Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"email":"demo@traco.com.br","password":"demo123"}'
$tok = $login.token
Write-Host ("LOGIN OK - user: " + $login.user.email)

$h = @{ Authorization = ("Bearer " + $tok) }

Write-Host '=== ME ==='
(Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/me' -Headers $h) | ConvertTo-Json -Compress

Write-Host '=== PROJETOS ==='
(Invoke-RestMethod -Uri 'http://localhost:8000/api/projetos' -Headers $h) | ConvertTo-Json -Compress -Depth 5

Write-Host '=== CREATE PROJETO ==='
(Invoke-RestMethod -Uri 'http://localhost:8000/api/projetos' -Method Post -Headers $h -ContentType 'application/json' -Body '{"name":"Projeto Teste PS","type":"comercial"}') | ConvertTo-Json -Compress

Write-Host '=== UPLOAD autenticado ==='
curl.exe -s -H ("Authorization: Bearer " + $tok) -F 'file=@test-planta.pdf' http://localhost:8000/api/plantas/upload
Write-Host ''

Write-Host '=== UPLOAD legado (sem auth) ==='
curl.exe -s -F 'file=@test-planta.pdf' http://localhost:8000/upload/
Write-Host ''

Start-Sleep -Seconds 5

Write-Host '=== PLANTAS ==='
(Invoke-RestMethod -Uri 'http://localhost:8000/api/plantas' -Headers $h) | ConvertTo-Json -Compress -Depth 5

Write-Host '=== ANALISES ==='
(Invoke-RestMethod -Uri 'http://localhost:8000/api/analises' -Headers $h) | ConvertTo-Json -Compress -Depth 6

Write-Host '=== LOGIN errado (esperado 401) ==='
try {
  Invoke-RestMethod -Uri 'http://localhost:8000/api/auth/login' -Method Post -ContentType 'application/json' -Body '{"email":"demo@traco.com.br","password":"errada"}' | Out-Null
  Write-Host 'ERRO: nao deveria ter logado'
} catch {
  Write-Host ('OK 401 como esperado: ' + [int]$_.Exception.Response.StatusCode)
}

Write-Host '=== FIM ==='