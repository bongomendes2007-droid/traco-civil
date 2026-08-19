# TRAÇO - Script de Inicialização
# Executa o backend e abre o frontend no navegador

Write-Host "🚀 Iniciando TRAÇO - Sistema de Orçamento Inteligente" -ForegroundColor Orange
Write-Host ""

# Verifica se está no diretório correto
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

# Backend
Write-Host "📦 Verificando backend..." -ForegroundColor Cyan
$backendDir = Join-Path $scriptDir "backend"

if (-Not (Test-Path $backendDir)) {
    Write-Host "❌ Diretório backend não encontrado!" -ForegroundColor Red
    exit 1
}

Set-Location $backendDir

# Verifica se o venv existe
$venvDir = Join-Path $backendDir "venv"
if (-Not (Test-Path $venvDir)) {
    Write-Host "🔧 Criando ambiente virtual..." -ForegroundColor Yellow
    python -m venv venv

    Write-Host "📥 Instalando dependências..." -ForegroundColor Yellow
    & "$venvDir\Scripts\pip.exe" install -r requirements.txt
}

# Verifica se .env existe
$envFile = Join-Path $backendDir ".env"
$envExample = Join-Path $backendDir ".env.example"
if (-Not (Test-Path $envFile)) {
    Write-Host "⚙️  Criando arquivo .env a partir do exemplo..." -ForegroundColor Yellow
    Copy-Item $envExample $envFile
}

# Inicia o backend em background
Write-Host "🌐 Iniciando backend em http://localhost:8000..." -ForegroundColor Green
$backendJob = Start-Process -FilePath "$venvDir\Scripts\python.exe" -ArgumentList "main.py" -PassThru -WindowStyle Hidden

# Aguarda o backend iniciar
Write-Host "⏳ Aguardando backend iniciar..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

# Frontend
Write-Host "🎨 Abrindo frontend..." -ForegroundColor Green
$frontendDir = Join-Path $scriptDir "frontend"
$frontendFile = Join-Path $frontendDir "index.html"

if (Test-Path $frontendFile) {
    Start-Process $frontendFile
    Write-Host ""
    Write-Host "✅ TRAÇO iniciado com sucesso!" -ForegroundColor Green
    Write-Host "   Backend: http://localhost:8000" -ForegroundColor Cyan
    Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
    Write-Host "   Frontend: Aberto no navegador" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Pressione Ctrl+C para parar o backend" -ForegroundColor Yellow

    # Mantém o script rodando para que o backend continue ativo
    try {
        Wait-Process -Id $backendJob.Id
    } catch {
        Write-Host ""
        Write-Host "🛑 Parando backend..." -ForegroundColor Yellow
        Stop-Process -Id $backendJob.Id -Force
    }
} else {
    Write-Host "❌ Frontend não encontrado em $frontendFile" -ForegroundColor Red
    Stop-Process -Id $backendJob.Id -Force
}