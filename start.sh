#!/bin/bash
# TRAÇO - Script de Inicialização para Linux/Mac
# Executa o backend e abre o frontend no navegador

echo "🚀 Iniciando TRAÇO - Sistema de Orçamento Inteligente"
echo ""

# Verifica se está no diretório correto
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR" || exit 1

# Backend
echo "📦 Verificando backend..."
BACKEND_DIR="$SCRIPT_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Diretório backend não encontrado!"
    exit 1
fi

cd "$BACKEND_DIR" || exit 1

# Verifica se o venv existe
VENV_DIR="$BACKEND_DIR/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "🔧 Criando ambiente virtual..."
    python3 -m venv venv

    echo "📥 Instalando dependências..."
    "$VENV_DIR/bin/pip" install -r requirements.txt
fi

# Verifica se .env existe
ENV_FILE="$BACKEND_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"
if [ ! -f "$ENV_FILE" ]; then
    echo "⚙️  Criando arquivo .env a partir do exemplo..."
    cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

# Inicia o backend em background
echo "🌐 Iniciando backend em http://localhost:8000..."
"$VENV_DIR/bin/python" main.py &
BACKEND_PID=$!

# Aguarda o backend iniciar
echo "⏳ Aguardando backend iniciar..."
sleep 3

# Frontend
echo "🎨 Abrindo frontend..."
FRONTEND_FILE="$SCRIPT_DIR/frontend/index.html"

if [ -f "$FRONTEND_FILE" ]; then
    # Tenta abrir no navegador (diferentes comandos por OS)
    if command -v xdg-open &> /dev/null; then
        xdg-open "$FRONTEND_FILE" 2>/dev/null &
    elif command -v open &> /dev/null; then
        open "$FRONTEND_FILE" 2>/dev/null &
    else
        echo "   ⚠️  Não foi possível abrir o navegador automaticamente."
        echo "   Abra manualmente: $FRONTEND_FILE"
    fi

    echo ""
    echo "✅ TRAÇO iniciado com sucesso!"
    echo "   Backend: http://localhost:8000"
    echo "   API Docs: http://localhost:8000/docs"
    echo "   Frontend: Aberto no navegador"
    echo ""
    echo "Pressione Ctrl+C para parar o backend"

    # Aguarda o backend
    wait $BACKEND_PID
else
    echo "❌ Frontend não encontrado em $FRONTEND_FILE"
    kill $BACKEND_PID 2>/dev/null
fi