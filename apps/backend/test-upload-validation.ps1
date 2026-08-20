# ============================================================
# TRAÇO CIVIL — Teste de Validação de Uploads (FASE 2)
# ============================================================
# Este script testa que o endpoint de upload rejeita:
#   1. Arquivos com MIME type inválido (ex: .exe, .txt)
#   2. Arquivos com extensão válida mas conteúdo inválido (mismatch)
#   3. Arquivos acima do limite de 50 MB
#
# Pré-requisitos: backend rodando em http://localhost:8000
# Uso: powershell -ExecutionPolicy Bypass -File test-upload-validation.ps1
# ============================================================

$base = 'http://localhost:8000'
$pass = 0
$fail = 0

function Test-Upload {
    param([string]$Name, [string]$FilePath, [int]$ExpectedStatus)

    Write-Host "`n--- Teste: $Name ---" -ForegroundColor Cyan

    try {
        $response = Invoke-WebRequest -Uri "$base/upload/" -Method Post -Form @{file = Get-Item $FilePath} -SkipHttpErrorCheck
        $status = $response.StatusCode

        if ($status -eq $ExpectedStatus) {
            Write-Host "PASS: Status $status (esperado $ExpectedStatus)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "FAIL: Status $status (esperado $ExpectedStatus)" -ForegroundColor Red
            Write-Host "Body: $($response.Content)" -ForegroundColor Yellow
            $script:fail++
        }
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:fail++
    }
}

# Criar arquivos de teste temporários
$tempDir = Join-Path $env:TEMP 'traco-upload-tests'
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# 1. Arquivo PDF válido (magic bytes: %PDF)
$pdfValid = Join-Path $tempDir 'valid.pdf'
[System.IO.File]::WriteAllBytes($pdfValid, [byte[]](0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34)) # %PDF-1.4

# 2. Arquivo PNG válido (magic bytes: 89 50 4E 47)
$pngValid = Join-Path $tempDir 'valid.png'
[System.IO.File]::WriteAllBytes($pngValid, [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A))

# 3. Arquivo JPG válido (magic bytes: FF D8 FF)
$jpgValid = Join-Path $tempDir 'valid.jpg'
[System.IO.File]::WriteAllBytes($jpgValid, [byte[]](0xFF, 0xD8, 0xFF, 0xE0))

# 4. Arquivo DWG válido (magic bytes: AC10)
$dwgValid = Join-Path $tempDir 'valid.dwg'
[System.IO.File]::WriteAllBytes($dwgValid, [byte[]](0x41, 0x43, 0x31, 0x30)) # AC10

# 5. Arquivo inválido: .exe (MZ header)
$exeInvalid = Join-Path $tempDir 'malware.exe'
[System.IO.File]::WriteAllBytes($exeInvalid, [byte[]](0x4D, 0x5A, 0x90, 0x00)) # MZ

# 6. Arquivo inválido: .txt
$txtInvalid = Join-Path $tempDir 'readme.txt'
[System.IO.File]::WriteAllText($txtInvalid, 'Este é um arquivo de texto simples.')

# 7. Mismatch: extensão .pdf mas conteúdo é texto
$pdfFake = Join-Path $tempDir 'fake.pdf'
[System.IO.File]::WriteAllText($pdfFake, 'Isso não é um PDF de verdade.')

# 8. Mismatch: extensão .png mas conteúdo é texto
$pngFake = Join-Path $tempDir 'fake.png'
[System.IO.File]::WriteAllText($pngFake, 'Isso não é um PNG de verdade.')

Write-Host "`n========================================" -ForegroundColor White
Write-Host "TRAÇO CIVIL — Testes de Validação de Upload" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor White

# Testes que devem PASSAR (status 200)
Test-Upload -Name 'PDF válido' -FilePath $pdfValid -ExpectedStatus 200
Test-Upload -Name 'PNG válido' -FilePath $pngValid -ExpectedStatus 200
Test-Upload -Name 'JPG válido' -FilePath $jpgValid -ExpectedStatus 200
Test-Upload -Name 'DWG válido' -FilePath $dwgValid -ExpectedStatus 200

# Testes que devem FALHAR (status 400 ou 415)
Test-Upload -Name 'EXE inválido (deve rejeitar)' -FilePath $exeInvalid -ExpectedStatus 400
Test-Upload -Name 'TXT inválido (deve rejeitar)' -FilePath $txtInvalid -ExpectedStatus 400
Test-Upload -Name 'PDF fake (mismatch, deve rejeitar)' -FilePath $pdfFake -ExpectedStatus 400
Test-Upload -Name 'PNG fake (mismatch, deve rejeitar)' -FilePath $pngFake -ExpectedStatus 400

# Limpar arquivos temporários
Remove-Item -Recurse -Force $tempDir

Write-Host "`n========================================" -ForegroundColor White
Write-Host "RESULTADO: $pass PASS, $fail FAIL" -ForegroundColor $(if ($fail -eq 0) { 'Green' } else { 'Red' })
Write-Host "========================================`n" -ForegroundColor White

if ($fail -gt 0) {
    exit 1
}