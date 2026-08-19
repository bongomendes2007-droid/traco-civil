# TRAÇO — Sistema de Orçamento Inteligente de Obras

Sistema de análise automática de plantas arquitetônicas usando IA para extração de quantitativos e geração de orçamentos baseados no SINAPI.

## 🎯 Funcionalidades

### ✅ Implementado (Passo 1)

- **Upload de Plantas**: Sistema completo para upload de arquivos em múltiplos formatos
  - PDF (plantas digitalizadas)
  - DWG/DXF (AutoCAD)
  - Imagens (JPG, PNG, TIFF, BMP, WebP)
- **Gestão de Projetos**: Criação e organização de projetos de obra
- **Interface Web**: Frontend responsivo com drag-and-drop
- **API REST**: Backend FastAPI com documentação automática

### 🚧 Em Desenvolvimento

- **IA de Visão Computacional**: Leitura automática de plantas
- **Integração SINAPI**: Base de dados atualizada de custos
- **Cálculo de Quantitativos**: Algoritmos de extração de materiais
- **Edição Manual**: Sistema de correção pelo usuário

## 📁 Estrutura do Projeto

```
traco/
├── backend/
│   ├── main.py              # API FastAPI principal
│   ├── requirements.txt     # Dependências Python
│   ├── .env.example         # Variáveis de ambiente
│   ├── uploads/             # Arquivos enviados (criado automaticamente)
│   └── projects/            # Metadados dos projetos (criado automaticamente)
├── frontend/
│   └── index.html           # Interface web
└── README.md                # Este arquivo
```

## 🚀 Como Executar

### Pré-requisitos

- Python 3.8+
- Navegador web moderno

### 1. Backend (API)

```bash
# Navegue até o diretório do backend
cd traco/backend

# Crie um ambiente virtual (recomendado)
python -m venv venv

# Ative o ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt

# Copie o arquivo de exemplo de variáveis de ambiente
copy .env.example .env
# Linux/Mac:
# cp .env.example .env

# Execute o servidor
python main.py
```

O backend estará disponível em: `http://localhost:8000`
Documentação interativa da API: `http://localhost:8000/docs`

### 2. Frontend (Interface Web)

**Opção A: Abrir diretamente**
- Abra o arquivo `traco/frontend/index.html` no navegador

**Opção B: Servidor HTTP local (recomendado)**
```bash
# Navegue até o diretório do frontend
cd traco/frontend

# Execute um servidor HTTP simples
python -m http.server 3000
```

Acesse: `http://localhost:3000`

## 📡 Endpoints da API

### Projetos

- `POST /api/projects` - Criar novo projeto
  - Query params: `name`, `description` (opcional)
  
- `GET /api/projects` - Listar todos os projetos

- `GET /api/projects/{id}` - Obter detalhes de um projeto

### Upload de Arquivos

- `POST /api/upload/{project_id}` - Enviar arquivo para um projeto
  - Body: `multipart/form-data` com campo `file`
  - Suporta: PDF, DWG, DXF, JPG, PNG, BMP, TIFF, WebP
  - Tamanho máximo: 100MB

- `GET /api/projects/{project_id}/files` - Listar arquivos do projeto

- `DELETE /api/projects/{project_id}/files/{filename}` - Remover arquivo

### Sistema

- `GET /` - Informações da API
- `GET /health` - Status do servidor

## 🔧 Configuração

Variáveis de ambiente disponíveis em `backend/.env.example`:

- `CORS_ORIGINS` - Origens permitidas para CORS
- `UPLOAD_DIR` - Diretório de uploads
- `PROJECTS_DIR` - Diretório de projetos
- `MAX_FILE_SIZE` - Tamanho máximo de arquivo (bytes)
- `PORT` - Porta do servidor
- `ENV` - Ambiente (development, production, test)

## 📊 Fluxo de Trabalho

1. **Criar Projeto**: Defina um nome para sua obra
2. **Upload de Plantas**: Envie PDFs, DWGs ou imagens das plantas
3. **Processamento**: (Em desenvolvimento) IA analisa as plantas automaticamente
4. **Revisão**: (Em desenvolvimento) Revise e ajuste os quantitativos
5. **Orçamento**: (Em desenvolvimento) Gere orçamento baseado no SINAPI

## 🎨 Identidade Visual

O sistema segue o manual de identidade de marca TRAÇO v2.0:
- Cores: Laranja (#FF5A1F), Grafite (#1C1815)
- Tipografia: Space Grotesk, Inter, IBM Plex Mono
- Estilo: Técnico, preciso, profissional

## 📝 Licença

Projeto em desenvolvimento.

## 🤝 Contribuição

Este é um projeto em fase inicial. As próximas etapas incluem:
- Integração com modelos de visão computacional
- Base de dados SINAPI atualizada
- Algoritmos de extração de quantitativos
- Interface de edição manual

---

**TRAÇO** — Precisão no traço, confiança no orçamento.