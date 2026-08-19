@echo off
chcp 65001 >nul
echo.
echo 🚀 Iniciando TRAÇO - Sistema de Orçamento Inteligente
echo.

cd /d "%~dp0"

echo 📦 Verificando backend...
if not exist "backend" (
    echo ❌ Diretório backend não encontrado!
    pause
    exit /b 1
)

cd backend

if not exist "venv" (
    echo 🔧 Criando ambiente virtual...
    python -m venv venv

    echo 📥 Instalando dependências...
    call venv\Scripts\pip.exe install -r requirements.txt
)

if not exist ".env" (
    echo ⚙️  Criando arquivo .env a partir do exemplo...
    copy .env.example .env >nul
)

echo 🌐 Iniciando backend em http://localhost:8000...
start "TRAÇO Backend" venv\Scripts\python.exe main.py

echo ⏳ Aguardando backend iniciar...
timeout /t 3 /nobreak >nul

echo 🎨 Abrindo frontend...
cd ..\frontend
start index.html

echo.
echo ✅ TRAÇO iniciado com sucesso!
echo    Backend: http://localhost:8000
echo    API Docs: http://localhost:8000/docs
echo    Frontend: Aberto no navegador
echo.
echo Pressione qualquer tecla para parar o backend...
pause >nul

taskkill /FI "WINDOWTITLE eq TRAÇO Backend*" /F >nul 2>&1
echo 🛑 Backend parado.